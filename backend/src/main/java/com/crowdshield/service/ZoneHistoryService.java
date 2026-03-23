package com.crowdshield.service;

import com.crowdshield.model.Zone;
import com.crowdshield.model.ZoneHistory;
import com.crowdshield.repository.ZoneHistoryRepository;
import com.crowdshield.repository.ZoneRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class ZoneHistoryService {

    private final ZoneHistoryRepository historyRepo;
    private final ZoneRepository zoneRepo;
    private final SimpMessagingTemplate messagingTemplate;

    /** Record a snapshot for a specific zone immediately (on count change) */
    public ZoneHistory snapshot(Zone zone) {
        ZoneHistory h = new ZoneHistory();
        h.setZoneId(zone.getId());
        h.setZoneName(zone.getName());
        h.setCurrentCount(zone.getCurrentCount());
        h.setCapacity(zone.getCapacity());
        h.setDensityPct(zone.getDensityPercentage());
        h.setStatus(zone.getStatus());
        h.setRecordedAt(LocalDateTime.now());
        return historyRepo.save(h);
    }

    /** Get history for one zone over the past N hours */
    public List<ZoneHistory> getHistory(String zoneId, int hours) {
        LocalDateTime since = LocalDateTime.now().minusHours(hours);
        return historyRepo.findByZoneIdAndRecordedAtAfterOrderByRecordedAtAsc(zoneId, since);
    }

    /** Get history for all zones over the past N hours */
    public List<ZoneHistory> getAllHistory(int hours) {
        LocalDateTime since = LocalDateTime.now().minusHours(hours);
        return historyRepo.findByRecordedAtAfterOrderByRecordedAtAsc(since);
    }

    /** Scheduled: purge history older than 7 days */
    @Scheduled(cron = "0 0 3 * * *")
    public void purgeOldHistory() {
        LocalDateTime cutoff = LocalDateTime.now().minusDays(7);
        historyRepo.deleteByRecordedAtBefore(cutoff);
        log.info("Purged zone history older than 7 days");
    }

    /** Scheduled: broadcast latest counts every 30s for trend line updates */
    @Scheduled(fixedDelay = 30000)
    public void broadcastSnapshot() {
        List<Zone> zones = zoneRepo.findAll();
        if (zones.isEmpty()) return;
        Map<String, Object> payload = new HashMap<>();
        payload.put("snapshots", zones.stream().map(z -> {
            Map<String, Object> m = new HashMap<>();
            m.put("zoneId",   z.getId());
            m.put("zoneName", z.getName());
            m.put("count",    z.getCurrentCount());
            m.put("capacity", z.getCapacity());
            m.put("density",  z.getDensityPercentage());
            m.put("status",   z.getStatus());
            m.put("ts",       LocalDateTime.now().toString());
            return m;
        }).toList());
        messagingTemplate.convertAndSend("/topic/history", payload);
    }
}
