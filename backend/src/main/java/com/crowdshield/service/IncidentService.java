package com.crowdshield.service;

import com.crowdshield.exception.ResourceNotFoundException;
import com.crowdshield.model.Alert;
import com.crowdshield.model.Incident;
import com.crowdshield.repository.AlertRepository;
import com.crowdshield.repository.IncidentRepository;
import com.crowdshield.repository.ZoneRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.*;

@Service
@RequiredArgsConstructor
public class IncidentService {

    private final IncidentRepository        incidentRepository;
    private final ZoneRepository            zoneRepository;
    private final AlertRepository           alertRepository;
    private final TwilioNotificationService notificationService;
    private final SimpMessagingTemplate     messagingTemplate;
    private final AlertBroadcastService     alertBroadcast;

    public List<Incident> getAllIncidents() {
        return incidentRepository.findAllByOrderByReportedAtDesc();
    }

    public Optional<Incident> getIncidentById(String id) {
        return incidentRepository.findById(id);
    }

    public Incident createIncident(Incident incident) {
        incident.setStatus(Incident.IncidentStatus.OPEN);
        incident.setReportedAt(LocalDateTime.now());
        if (incident.getZoneId() != null && !incident.getZoneId().isBlank())
            zoneRepository.findById(incident.getZoneId())
                .ifPresent(z -> incident.setZoneName(z.getName()));

        Incident saved = incidentRepository.save(incident);

        Alert alert = new Alert();
        alert.setZoneId(incident.getZoneId());
        alert.setZoneName(incident.getZoneName());
        alert.setMessage("⚑ Incident [" + incident.getSeverity() + "]: " + incident.getTitle()
            + (incident.getZoneName() != null ? " @ " + incident.getZoneName() : ""));
        alert.setType(Alert.AlertType.INCIDENT_REPORTED);
        alert.setAcknowledged(false);
        alert.setCreatedAt(LocalDateTime.now());
        alertRepository.save(alert);

        broadcastIncidents();
        alertBroadcast.broadcast();
        notificationService.notifyAll("INCIDENT_REPORTED",
            incident.getZoneName() != null ? incident.getZoneName() : "Unknown",
            "Incident: " + incident.getTitle());
        return saved;
    }

    public Incident updateIncident(String id, Incident updated) {
        Incident saved = incidentRepository.findById(id).map(incident -> {
            incident.setTitle(updated.getTitle());
            incident.setDescription(updated.getDescription());
            incident.setType(updated.getType());
            incident.setSeverity(updated.getSeverity());
            incident.setStatus(updated.getStatus());
            if (updated.getStatus() == Incident.IncidentStatus.RESOLVED
                    || updated.getStatus() == Incident.IncidentStatus.CLOSED) {
                incident.setResolvedAt(LocalDateTime.now());
                incident.setResolutionNotes(updated.getResolutionNotes());
            }
            return incidentRepository.save(incident);
        }).orElseThrow(() -> new ResourceNotFoundException("Incident", id));
        broadcastIncidents();
        return saved;
    }

    public Incident resolveIncident(String id) {
        Incident saved = incidentRepository.findById(id).map(incident -> {
            incident.setStatus(Incident.IncidentStatus.RESOLVED);
            incident.setResolvedAt(LocalDateTime.now());
            incident.setResolutionNotes("Resolved via dashboard");
            return incidentRepository.save(incident);
        }).orElseThrow(() -> new ResourceNotFoundException("Incident", id));
        broadcastIncidents();
        return saved;
    }

    public void deleteIncident(String id) {
        incidentRepository.deleteById(id);
        broadcastIncidents();
    }

    public List<Incident> getIncidentsByZone(String zoneId) {
        return incidentRepository.findByZoneId(zoneId);
    }

    public List<Incident> getOpenIncidents() {
        return incidentRepository.findByStatus(Incident.IncidentStatus.OPEN);
    }

    public long getOpenIncidentCount() {
        return incidentRepository.countByStatus(Incident.IncidentStatus.OPEN);
    }

    public void broadcastIncidents() {
        List<Incident> all = incidentRepository.findAllByOrderByReportedAtDesc();
        Map<String, Object> payload = new HashMap<>();
        payload.put("incidents", all);
        payload.put("openCount", all.stream().filter(i -> i.getStatus() == Incident.IncidentStatus.OPEN).count());
        payload.put("timestamp", LocalDateTime.now().toString());
        messagingTemplate.convertAndSend("/topic/incidents", payload);
    }
}
