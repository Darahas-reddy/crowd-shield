package com.crowdshield.service;

import com.crowdshield.model.Incident;
import com.crowdshield.model.Zone;
import com.crowdshield.repository.AlertRepository;
import com.crowdshield.repository.IncidentRepository;
import com.crowdshield.repository.TrackedUserRepository;
import com.crowdshield.repository.ZoneRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Component
@RequiredArgsConstructor
public class StatsScheduler {

    private final ZoneRepository         zoneRepo;
    private final IncidentRepository     incidentRepo;
    private final AlertRepository        alertRepo;
    private final TrackedUserRepository  trackedRepo;
    private final SimpMessagingTemplate  messaging;
    private final RiskScoreService       riskScoreService;

    @Scheduled(fixedDelay = 8000)
    public void broadcastStats() {
        List<Zone> zones   = zoneRepo.findAll();
        int  totalCap      = zones.stream().mapToInt(Zone::getCapacity).sum();
        int  totalCount    = zones.stream().mapToInt(Zone::getCurrentCount).sum();
        long critCount     = zones.stream().filter(z -> z.getStatus() == Zone.ZoneStatus.CRITICAL).count();
        long warnCount     = zones.stream().filter(z -> z.getStatus() == Zone.ZoneStatus.WARNING).count();
        long evacCount     = zones.stream().filter(z -> z.getStatus() == Zone.ZoneStatus.EVACUATING).count();
        long openIncs      = incidentRepo.countByStatus(Incident.IncidentStatus.OPEN);
        long unackedAlerts = alertRepo.countByAcknowledgedFalse();
        long activeUsers   = trackedRepo.findByActiveTrue().size();

        Map<String, Object> stats = new HashMap<>();
        stats.put("totalZones",            zones.size());
        stats.put("totalCapacity",         totalCap);
        stats.put("totalCurrentCount",     totalCount);
        stats.put("overallDensity",        totalCap > 0 ? (double) totalCount / totalCap * 100 : 0);
        stats.put("criticalZones",         critCount);
        stats.put("warningZones",          warnCount);
        stats.put("evacuatingZones",       evacCount);
        stats.put("safeZones",             zones.size() - critCount - warnCount - evacCount);
        stats.put("openIncidents",         openIncs);
        stats.put("unacknowledgedAlerts",  unackedAlerts);
        stats.put("activeGpsUsers",        activeUsers);
        stats.put("evacuationActive",      evacCount > 0);
        stats.put("timestamp",             LocalDateTime.now().toString());
        stats.put("riskScores",            riskScoreService.scoreAll(zones));

        messaging.convertAndSend("/topic/stats", stats);
    }
}
