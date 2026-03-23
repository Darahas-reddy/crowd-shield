package com.crowdshield.controller;

import com.crowdshield.dto.request.ZoneRequest;
import com.crowdshield.dto.response.ZoneResponse;
import com.crowdshield.exception.BadRequestException;
import com.crowdshield.exception.ResourceNotFoundException;
import com.crowdshield.model.Zone;
import com.crowdshield.model.ZoneHistory;
import com.crowdshield.service.ZoneHistoryService;
import com.crowdshield.service.ZoneService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/zones")
@RequiredArgsConstructor
public class ZoneController {

    private final ZoneService        zoneService;
    private final ZoneHistoryService historyService;

    // ── CRUD ────────────────────────────────────────────────────────────────

    @GetMapping
    public List<ZoneResponse> getAllZones() {
        return zoneService.getAllZones().stream().map(ZoneResponse::from).toList();
    }

    @GetMapping("/{id}")
    public ZoneResponse getZone(@PathVariable String id) {
        return ZoneResponse.from(
            zoneService.getZoneById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Zone", id))
        );
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    @ResponseStatus(HttpStatus.CREATED)
    public ZoneResponse createZone(@Valid @RequestBody ZoneRequest req) {
        return ZoneResponse.from(zoneService.createZone(toModel(req)));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ZoneResponse updateZone(@PathVariable String id, @Valid @RequestBody ZoneRequest req) {
        return ZoneResponse.from(zoneService.updateZone(id, toModel(req)));
    }

    @PatchMapping("/{id}/count")
    @PreAuthorize("hasAnyRole('ADMIN','USER')")
    public ZoneResponse updateCount(@PathVariable String id,
                                    @RequestBody Map<String, Integer> body) {
        Integer count = body.get("count");
        if (count == null || count < 0)
            throw new BadRequestException("count must be a non-negative integer");
        return ZoneResponse.from(zoneService.updateCrowdCount(id, count));
    }

    @PatchMapping("/{id}/evacuate")
    @PreAuthorize("hasRole('ADMIN')")
    public ZoneResponse evacuate(@PathVariable String id) {
        return ZoneResponse.from(zoneService.evacuateZone(id));
    }

    @PatchMapping("/{id}/cancel-evacuate")
    @PreAuthorize("hasRole('ADMIN')")
    public ZoneResponse cancelEvacuate(@PathVariable String id) {
        return ZoneResponse.from(zoneService.cancelEvacuation(id));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteZone(@PathVariable String id) {
        zoneService.deleteZone(id);
    }

    @GetMapping("/status/{status}")
    public List<ZoneResponse> getByStatus(@PathVariable Zone.ZoneStatus status) {
        return zoneService.getZonesByStatus(status).stream().map(ZoneResponse::from).toList();
    }

    // ── History ──────────────────────────────────────────────────────────────

    @GetMapping("/{id}/history")
    public List<ZoneHistory> getHistory(@PathVariable String id,
                                        @RequestParam(defaultValue = "24") int hours) {
        return historyService.getHistory(id, hours);
    }

    @GetMapping("/history/all")
    public List<ZoneHistory> getAllHistory(@RequestParam(defaultValue = "24") int hours) {
        return historyService.getAllHistory(hours);
    }

    // ── Private ──────────────────────────────────────────────────────────────

    private Zone toModel(ZoneRequest r) {
        Zone z = new Zone();
        z.setName(r.name());
        z.setLocation(r.location());
        z.setCapacity(r.capacity());
        z.setLatitude(r.latitude());
        z.setLongitude(r.longitude());
        z.setShapeType(r.shapeType() != null ? r.shapeType() : "circle");
        z.setRadiusMetres(r.radiusMetres() > 0 ? r.radiusMetres() : 200);
        z.setPolygonCoords(r.polygonCoords());
        return z;
    }
}
