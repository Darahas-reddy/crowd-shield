package com.crowdshield.service;

import com.crowdshield.exception.ResourceNotFoundException;
import com.crowdshield.model.Alert;
import com.crowdshield.model.Zone;
import com.crowdshield.repository.AlertRepository;
import com.crowdshield.repository.ZoneRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.*;

@Service
@RequiredArgsConstructor
public class ZoneService {

    private final ZoneRepository            zoneRepository;
    private final AlertRepository           alertRepository;
    private final GeoService                geoService;
    private final TwilioNotificationService notificationService;
    private final SimpMessagingTemplate     messagingTemplate;
    private final AlertBroadcastService     alertBroadcast;

    public List<Zone> getAllZones()                  { return zoneRepository.findAll(); }
    public Optional<Zone> getZoneById(String id)    { return zoneRepository.findById(id); }

    public Zone createZone(Zone zone) {
        zone.setStatus(Zone.ZoneStatus.SAFE);
        zone.setCurrentCount(0);
        zone.setLastUpdated(LocalDateTime.now());
        computeArea(zone);
        computeCentroid(zone);
        Zone saved = zoneRepository.save(zone);
        broadcastZones();
        return saved;
    }

    public Zone updateZone(String id, Zone updated) {
        Zone saved = zoneRepository.findById(id).map(zone -> {
            zone.setName(updated.getName());
            zone.setLocation(updated.getLocation());
            zone.setCapacity(updated.getCapacity());
            if (updated.getShapeType() != null)      zone.setShapeType(updated.getShapeType());
            if (updated.getRadiusMetres() > 0)        zone.setRadiusMetres(updated.getRadiusMetres());
            if (updated.getPolygonCoords() != null)   zone.setPolygonCoords(updated.getPolygonCoords());
            if (updated.getLatitude() != 0)           zone.setLatitude(updated.getLatitude());
            if (updated.getLongitude() != 0)          zone.setLongitude(updated.getLongitude());
            zone.setLastUpdated(LocalDateTime.now());
            computeArea(zone);
            computeCentroid(zone);
            return zoneRepository.save(zone);
        }).orElseThrow(() -> new ResourceNotFoundException("Zone", id));
        broadcastZones();
        return saved;
    }

    public Zone updateCrowdCount(String id, int count) {
        Zone saved = zoneRepository.findById(id).map(zone -> {
            zone.setCurrentCount(Math.max(0, count));
            zone.setLastUpdated(LocalDateTime.now());
            double density  = zone.getDensityPercentage();
            Zone.ZoneStatus prev = zone.getStatus();
            if (zone.getStatus() != Zone.ZoneStatus.EVACUATING) {
                if (density >= 95) {
                    zone.setStatus(Zone.ZoneStatus.CRITICAL);
                    if (prev != Zone.ZoneStatus.CRITICAL)
                        createAlert(zone, Alert.AlertType.DENSITY_CRITICAL,
                            "🚨 CRITICAL: " + zone.getName() + " at " + (int) density + "% capacity!");
                } else if (density >= 75) {
                    zone.setStatus(Zone.ZoneStatus.WARNING);
                    if (prev == Zone.ZoneStatus.SAFE)
                        createAlert(zone, Alert.AlertType.DENSITY_WARNING,
                            "⚠️ WARNING: " + zone.getName() + " at " + (int) density + "% capacity");
                } else {
                    zone.setStatus(Zone.ZoneStatus.SAFE);
                }
            }
            return zoneRepository.save(zone);
        }).orElseThrow(() -> new ResourceNotFoundException("Zone", id));
        broadcastZones();
        return saved;
    }

    public Zone evacuateZone(String id) {
        Zone saved = zoneRepository.findById(id).map(zone -> {
            zone.setStatus(Zone.ZoneStatus.EVACUATING);
            zone.setLastUpdated(LocalDateTime.now());
            return zoneRepository.save(zone);
        }).orElseThrow(() -> new ResourceNotFoundException("Zone", id));
        broadcastZones();
        return saved;
    }

    public Zone cancelEvacuation(String id) {
        Zone saved = zoneRepository.findById(id).map(zone -> {
            double density = zone.getDensityPercentage();
            zone.setStatus(density >= 95 ? Zone.ZoneStatus.CRITICAL
                         : density >= 75 ? Zone.ZoneStatus.WARNING
                         : Zone.ZoneStatus.SAFE);
            zone.setLastUpdated(LocalDateTime.now());
            return zoneRepository.save(zone);
        }).orElseThrow(() -> new ResourceNotFoundException("Zone", id));
        broadcastZones();
        return saved;
    }

    public void deleteZone(String id) {
        zoneRepository.deleteById(id);
        broadcastZones();
    }

    public List<Zone> getZonesByStatus(Zone.ZoneStatus status) {
        return zoneRepository.findByStatus(status);
    }

    public void broadcastZones() {
        List<Zone> zones   = zoneRepository.findAll();
        int totalCap       = zones.stream().mapToInt(Zone::getCapacity).sum();
        int totalCount     = zones.stream().mapToInt(Zone::getCurrentCount).sum();
        Map<String, Object> payload = new HashMap<>();
        payload.put("zones",          zones);
        payload.put("totalCapacity",  totalCap);
        payload.put("totalCount",     totalCount);
        payload.put("overallDensity", totalCap > 0 ? (double) totalCount / totalCap * 100 : 0);
        payload.put("criticalZones",  zones.stream().filter(z -> z.getStatus() == Zone.ZoneStatus.CRITICAL).count());
        payload.put("warningZones",   zones.stream().filter(z -> z.getStatus() == Zone.ZoneStatus.WARNING).count());
        payload.put("evacuatingZones",zones.stream().filter(z -> z.getStatus() == Zone.ZoneStatus.EVACUATING).count());
        payload.put("timestamp",      LocalDateTime.now().toString());
        messagingTemplate.convertAndSend("/topic/zones", payload);
    }

    private void computeArea(Zone zone) {
        if ("polygon".equals(zone.getShapeType()) && zone.getPolygonCoords() != null)
            zone.setAreaSquareMetres(geoService.polygonAreaSquareMetres(zone.getPolygonCoords()));
        else
            zone.setAreaSquareMetres(geoService.circleAreaSquareMetres(
                zone.getRadiusMetres() > 0 ? zone.getRadiusMetres() : 200));
    }

    private void computeCentroid(Zone zone) {
        if ("polygon".equals(zone.getShapeType()) && zone.getPolygonCoords() != null
                && !zone.getPolygonCoords().isEmpty()) {
            double[] c = geoService.polygonCentroid(zone.getPolygonCoords());
            zone.setLatitude(c[0]);
            zone.setLongitude(c[1]);
        }
    }

    private void createAlert(Zone zone, Alert.AlertType type, String message) {
        Alert a = new Alert();
        a.setZoneId(zone.getId());  a.setZoneName(zone.getName());
        a.setMessage(message);      a.setType(type);
        a.setAcknowledged(false);   a.setCreatedAt(LocalDateTime.now());
        alertRepository.save(a);
        alertBroadcast.broadcast();
        notificationService.notifyAll(type.name(), zone.getName(), message);
    }
}
