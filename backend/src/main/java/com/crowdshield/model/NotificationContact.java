package com.crowdshield.model;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import java.time.LocalDateTime;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "notification_contacts")
public class NotificationContact {

    @Id
    private String id;

    /** Display name (e.g. "Security Chief", "Event Manager") */
    private String name;

    /** Role / title shown in dashboard */
    private String role = "Staff";

    /**
     * Phone in E.164 format: +919876543210
     * For WhatsApp, Twilio prefixes "whatsapp:" automatically.
     */
    private String phone;

    /** Which channels to use for this contact */
    private boolean smsEnabled   = true;
    private boolean whatsappEnabled = true;

    /**
     * Which alert severities trigger a message to this contact.
     * Options: WARNING, CRITICAL, INCIDENT, EVACUATION, ALL
     */
    private List<String> notifyOn = List.of("CRITICAL", "INCIDENT", "EVACUATION");

    private boolean active = true;
    private LocalDateTime createdAt;
    private LocalDateTime lastNotifiedAt;
}
