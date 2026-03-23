package com.crowdshield.service;

import com.crowdshield.model.NotificationContact;
import com.crowdshield.model.NotificationLog;
import com.crowdshield.repository.NotificationContactRepository;
import com.crowdshield.repository.NotificationLogRepository;
import com.twilio.Twilio;
import com.twilio.rest.api.v2010.account.Message;
import com.twilio.type.PhoneNumber;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Slf4j
@Service
@RequiredArgsConstructor
public class TwilioNotificationService {

    private final NotificationContactRepository contactRepo;
    private final NotificationLogRepository     logRepo;

    @Value("${twilio.account-sid:}")
    private String accountSid;

    @Value("${twilio.auth-token:}")
    private String authToken;

    @Value("${twilio.from-number:}")
    private String fromNumber;

    @Value("${twilio.whatsapp-number:}")
    private String whatsappNumber;

    /** Minimum minutes between same alert type for the same contact */
    @Value("${twilio.cooldown-minutes:10}")
    private int cooldownMinutes;

    private boolean twilioReady = false;

    /**
     * Tracks last send time per contact+alertType to prevent spam.
     * Key: contactId + "_" + alertType
     */
    private final Map<String, LocalDateTime> cooldownMap = new ConcurrentHashMap<>();

    @PostConstruct
    public void init() {
        if (accountSid == null || accountSid.isBlank() ||
            authToken  == null || authToken.isBlank()) {
            log.warn("Twilio credentials not configured. Notifications disabled.");
            log.warn("Set twilio.account-sid and twilio.auth-token in application.properties");
            return;
        }
        try {
            Twilio.init(accountSid, authToken);
            twilioReady = true;
            log.info("Twilio initialized ✓  from={} whatsapp={}", fromNumber, whatsappNumber);
        } catch (Exception e) {
            log.error("Twilio init failed: {}", e.getMessage());
        }
    }

    /**
     * Main entry — called whenever an alert is created.
     * Notifies all active contacts that have this alertType in their notifyOn list.
     */
    public void notifyAll(String alertType, String zoneName, String message) {
        if (!twilioReady) {
            log.debug("Twilio not ready — skipping notification for {}", alertType);
            return;
        }

        List<NotificationContact> contacts = contactRepo.findByActiveTrue();
        if (contacts.isEmpty()) {
            log.debug("No active contacts configured.");
            return;
        }

        for (NotificationContact contact : contacts) {
            if (!shouldNotify(contact, alertType)) continue;
            if (isOnCooldown(contact.getId(), alertType)) {
                log.debug("Cooldown active for {} + {}", contact.getName(), alertType);
                continue;
            }

            String body = buildMessage(alertType, zoneName, message);

            if (contact.isSmsEnabled() && fromNumber != null && !fromNumber.isBlank()) {
                sendSms(contact, alertType, zoneName, body);
            }
            if (contact.isWhatsappEnabled() && whatsappNumber != null && !whatsappNumber.isBlank()) {
                sendWhatsApp(contact, alertType, zoneName, body);
            }

            // Update cooldown + lastNotifiedAt
            cooldownMap.put(contact.getId() + "_" + alertType, LocalDateTime.now());
            contact.setLastNotifiedAt(LocalDateTime.now());
            contactRepo.save(contact);
        }
    }

    /** Send test message to a single contact (ignores cooldown) */
    public NotificationLog sendTest(String contactId) {
        if (!twilioReady) throw new com.crowdshield.exception.BadRequestException("Twilio not configured — set credentials in application.properties");

        NotificationContact contact = contactRepo.findById(contactId)
            .orElseThrow(() -> new com.crowdshield.exception.ResourceNotFoundException("Contact", contactId));

        String body = "✅ CrowdShield test message — notifications are working!";

        if (contact.isSmsEnabled() && fromNumber != null && !fromNumber.isBlank()) {
            return sendSms(contact, "TEST", "Test", body);
        } else if (contact.isWhatsappEnabled() && whatsappNumber != null && !whatsappNumber.isBlank()) {
            return sendWhatsApp(contact, "TEST", "Test", body);
        }
        throw new com.crowdshield.exception.BadRequestException("No notification channel enabled for this contact");
    }

    // ─────────────────────────────────────────────────────────────────────────

    private NotificationLog sendSms(NotificationContact contact, String alertType,
                                     String zoneName, String body) {
        NotificationLog entry = baseLog(contact, "SMS", alertType, zoneName, body);
        try {
            Message msg = Message.creator(
                new PhoneNumber(contact.getPhone()),
                new PhoneNumber(fromNumber),
                body
            ).create();
            entry.setStatus("SENT");
            entry.setTwilioSid(msg.getSid());
            log.info("SMS sent → {} ({})  sid={}", contact.getName(), contact.getPhone(), msg.getSid());
        } catch (Exception e) {
            entry.setStatus("FAILED");
            entry.setErrorMessage(e.getMessage());
            log.error("SMS failed → {}: {}", contact.getName(), e.getMessage());
        }
        return logRepo.save(entry);
    }

    private NotificationLog sendWhatsApp(NotificationContact contact, String alertType,
                                          String zoneName, String body) {
        NotificationLog entry = baseLog(contact, "WHATSAPP", alertType, zoneName, body);
        try {
            Message msg = Message.creator(
                new PhoneNumber("whatsapp:" + contact.getPhone()),
                new PhoneNumber(whatsappNumber),
                body
            ).create();
            entry.setStatus("SENT");
            entry.setTwilioSid(msg.getSid());
            log.info("WhatsApp sent → {} ({})  sid={}", contact.getName(), contact.getPhone(), msg.getSid());
        } catch (Exception e) {
            entry.setStatus("FAILED");
            entry.setErrorMessage(e.getMessage());
            log.error("WhatsApp failed → {}: {}", contact.getName(), e.getMessage());
        }
        return logRepo.save(entry);
    }

    private NotificationLog baseLog(NotificationContact c, String channel,
                                     String alertType, String zoneName, String body) {
        NotificationLog l = new NotificationLog();
        l.setContactId(c.getId());
        l.setContactName(c.getName());
        l.setPhone(c.getPhone());
        l.setChannel(channel);
        l.setAlertType(alertType);
        l.setZoneName(zoneName);
        l.setMessage(body);
        l.setSentAt(LocalDateTime.now());
        return l;
    }

    private boolean shouldNotify(NotificationContact c, String alertType) {
        if (c.getNotifyOn() == null || c.getNotifyOn().isEmpty()) return false;
        return c.getNotifyOn().contains("ALL") || c.getNotifyOn().contains(alertType);
    }

    private boolean isOnCooldown(String contactId, String alertType) {
        LocalDateTime last = cooldownMap.get(contactId + "_" + alertType);
        if (last == null) return false;
        return ChronoUnit.MINUTES.between(last, LocalDateTime.now()) < cooldownMinutes;
    }

    private String buildMessage(String alertType, String zoneName, String dashMsg) {
        String emoji = switch (alertType) {
            case "DENSITY_CRITICAL"    -> "🚨";
            case "DENSITY_WARNING"     -> "⚠️";
            case "INCIDENT_REPORTED"   -> "⚑";
            case "EVACUATION_REQUIRED" -> "📢";
            default                    -> "ℹ️";
        };
        return String.format(
            "%s CrowdShield Alert\n\nZone: %s\n%s\n\nTime: %s\n\nRespond via dashboard.",
            emoji, zoneName, dashMsg, LocalDateTime.now().toString().substring(0, 16).replace("T", " ")
        );
    }

    public boolean isTwilioReady() { return twilioReady; }

    public List<NotificationLog> getRecentLogs() {
        return logRepo.findTop50ByOrderBySentAtDesc();
    }
}
