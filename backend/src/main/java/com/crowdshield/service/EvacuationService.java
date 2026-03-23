package com.crowdshield.service;

import com.crowdshield.model.Alert;
import com.crowdshield.model.Zone;
import com.crowdshield.repository.AlertRepository;
import com.crowdshield.repository.ZoneRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class EvacuationService {

    private final ZoneRepository            zoneRepository;
    private final AlertRepository           alertRepository;
    private final AlertBroadcastService     alertBroadcast;
    private final TwilioNotificationService notificationService;
    private final SimpMessagingTemplate     messaging;

    public Map<String, Object> activate(String reason) {
        List<Zone> zones = zoneRepository.findAll();
        zones.forEach(z -> { z.setStatus(Zone.ZoneStatus.EVACUATING); z.setLastUpdated(LocalDateTime.now()); });
        zoneRepository.saveAll(zones);
        saveAlert("🚨 EVACUATION ACTIVATED — " + reason, Alert.AlertType.EVACUATION_REQUIRED);
        broadcastZones(zones, "EVACUATION_ACTIVE", reason);
        alertBroadcast.broadcast();
        notificationService.notifyAll("EVACUATION_REQUIRED", "ALL ZONES", "EVACUATION: " + reason);
        return Map.of("status", "EVACUATING", "zonesAffected", zones.size(),
                      "reason", reason, "timestamp", LocalDateTime.now().toString());
    }

    public Map<String, Object> clear() {
        List<Zone> zones = zoneRepository.findAll();
        zones.stream()
             .filter(z -> z.getStatus() == Zone.ZoneStatus.EVACUATING)
             .forEach(z -> { z.setStatus(Zone.ZoneStatus.SAFE); z.setLastUpdated(LocalDateTime.now()); });
        zoneRepository.saveAll(zones);
        saveAlert("✅ All clear — evacuation lifted", Alert.AlertType.SYSTEM);
        broadcastZones(zones, "ALL_CLEAR", "");
        alertBroadcast.broadcast();
        return Map.of("status", "SAFE", "timestamp", LocalDateTime.now().toString());
    }

    private void saveAlert(String message, Alert.AlertType type) {
        Alert a = new Alert();
        a.setZoneId("ALL"); a.setZoneName("ALL ZONES");
        a.setMessage(message); a.setType(type);
        a.setAcknowledged(false); a.setCreatedAt(LocalDateTime.now());
        alertRepository.save(a);
    }

    private void broadcastZones(List<Zone> zones, String event, String reason) {
        Map<String, Object> zp = new HashMap<>();
        zp.put("zones", zones); zp.put("event", event);
        zp.put("reason", reason); zp.put("timestamp", LocalDateTime.now().toString());
        messaging.convertAndSend("/topic/zones", zp);
        messaging.convertAndSend("/topic/evacuation",
            Map.of("event", event, "reason", reason, "timestamp", LocalDateTime.now().toString()));
    }
}
