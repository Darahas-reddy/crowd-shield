package com.crowdshield.service;

import com.crowdshield.model.TrackedUser;
import com.crowdshield.model.Zone;
import com.crowdshield.repository.TrackedUserRepository;
import com.crowdshield.repository.ZoneRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import java.time.LocalDateTime;
import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class TrackingService {

    private final TrackedUserRepository trackedUserRepository;
    private final ZoneRepository zoneRepository;
    private final ZoneService zoneService;
    private final GeoService geoService;
    private final SimpMessagingTemplate messagingTemplate;

    private static final long INACTIVE_SECONDS = 30;

    /** Called every time a device pings */
    public TrackedUser updateLocation(String deviceId, String displayName,
                                      double lat, double lng, double accuracy) {
        TrackedUser user = trackedUserRepository.findByDeviceId(deviceId)
                .orElse(new TrackedUser());

        user.setDeviceId(deviceId);
        user.setDisplayName(displayName != null ? displayName : "User-" + deviceId.substring(0, Math.min(4, deviceId.length())));
        user.setLatitude(lat);
        user.setLongitude(lng);
        user.setAccuracy(accuracy);
        user.setLastSeen(LocalDateTime.now());
        user.setActive(true);

        String prevZoneId = user.getCurrentZoneId();
        Zone detected = detectZone(lat, lng);
        user.setCurrentZoneId(detected != null ? detected.getId() : null);
        user.setCurrentZoneName(detected != null ? detected.getName() : null);
        trackedUserRepository.save(user);

        if (!Objects.equals(prevZoneId, user.getCurrentZoneId())) {
            if (prevZoneId != null) recountZone(prevZoneId);
            if (user.getCurrentZoneId() != null) recountZone(user.getCurrentZoneId());
        }

        broadcastUpdate();
        return user;
    }

    /** Properly deactivate a user when they close the tracking page */
    public void deactivateUser(String deviceId) {
        trackedUserRepository.findByDeviceId(deviceId).ifPresent(u -> {
            String zoneId = u.getCurrentZoneId();
            u.setActive(false);
            u.setCurrentZoneId(null);
            u.setCurrentZoneName(null);
            trackedUserRepository.save(u);
            if (zoneId != null) recountZone(zoneId);
            broadcastUpdate();
        });
    }

    private Zone detectZone(double lat, double lng) {
        return zoneRepository.findAll().stream()
                .filter(z -> geoService.isInsideZone(lat, lng, z))
                .findFirst().orElse(null);
    }

    public void recountZone(String zoneId) {
        long count = trackedUserRepository.countByCurrentZoneIdAndActiveTrue(zoneId);
        try { zoneService.updateCrowdCount(zoneId, (int) count); }
        catch (Exception e) { log.warn("Could not recount zone {}: {}", zoneId, e.getMessage()); }
    }

    @Scheduled(fixedDelay = 15000)
    public void expireInactiveUsers() {
        LocalDateTime cutoff = LocalDateTime.now().minusSeconds(INACTIVE_SECONDS);
        List<TrackedUser> stale = trackedUserRepository.findByLastSeenBefore(cutoff);
        if (stale.isEmpty()) return;

        Set<String> affected = new HashSet<>();
        stale.forEach(u -> {
            if (u.isActive()) {
                if (u.getCurrentZoneId() != null) affected.add(u.getCurrentZoneId());
                u.setActive(false);
                u.setCurrentZoneId(null);
                u.setCurrentZoneName(null);
                trackedUserRepository.save(u);
            }
        });
        affected.forEach(this::recountZone);
        if (!affected.isEmpty()) broadcastUpdate();
    }

    public void broadcastUpdate() {
        Map<String, Object> payload = new HashMap<>();
        payload.put("users", trackedUserRepository.findByActiveTrue());
        payload.put("count", trackedUserRepository.findByActiveTrue().size());
        payload.put("timestamp", LocalDateTime.now().toString());
        messagingTemplate.convertAndSend("/topic/live", payload);
    }

    public List<TrackedUser> getActiveUsers() {
        return trackedUserRepository.findByActiveTrue();
    }
}
