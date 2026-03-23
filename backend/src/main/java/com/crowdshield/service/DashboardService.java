package com.crowdshield.service;

import com.crowdshield.model.Incident;
import com.crowdshield.model.Zone;
import com.crowdshield.repository.AlertRepository;
import com.crowdshield.repository.IncidentRepository;
import com.crowdshield.repository.TrackedUserRepository;
import com.crowdshield.repository.ZoneRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class DashboardService {

    private final ZoneRepository       zoneRepo;
    private final IncidentRepository   incidentRepo;
    private final AlertRepository      alertRepo;
    private final TrackedUserRepository trackedRepo;

    public Map<String, Object> getStats() {
        List<Zone> zones = zoneRepo.findAll();
        int totalCap   = zones.stream().mapToInt(Zone::getCapacity).sum();
        int totalCount = zones.stream().mapToInt(Zone::getCurrentCount).sum();
        long critical  = zones.stream().filter(z -> z.getStatus() == Zone.ZoneStatus.CRITICAL).count();
        long warning   = zones.stream().filter(z -> z.getStatus() == Zone.ZoneStatus.WARNING).count();
        long evacuating= zones.stream().filter(z -> z.getStatus() == Zone.ZoneStatus.EVACUATING).count();

        Map<String, Object> stats = new HashMap<>();
        stats.put("totalZones",            zones.size());
        stats.put("totalCapacity",         totalCap);
        stats.put("totalCurrentCount",     totalCount);
        stats.put("overallDensity",        totalCap > 0 ? (double) totalCount / totalCap * 100 : 0);
        stats.put("criticalZones",         critical);
        stats.put("warningZones",          warning);
        stats.put("evacuatingZones",       evacuating);
        stats.put("safeZones",             zones.size() - critical - warning - evacuating);
        stats.put("openIncidents",         incidentRepo.countByStatus(Incident.IncidentStatus.OPEN));
        stats.put("unacknowledgedAlerts",  alertRepo.countByAcknowledgedFalse());
        stats.put("activeGpsUsers",        trackedRepo.findByActiveTrue().size());
        stats.put("evacuationActive",      evacuating > 0);
        return stats;
    }
}
