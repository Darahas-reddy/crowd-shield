package com.crowdshield.controller;

import com.crowdshield.model.TrackedUser;
import com.crowdshield.service.TrackingService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/track")
@RequiredArgsConstructor
public class TrackingController {

    private final TrackingService trackingService;

    @PostMapping("/ping")
    public ResponseEntity<TrackedUser> ping(@RequestBody Map<String, Object> body) {
        String deviceId = (String) body.get("deviceId");
        String name     = (String) body.getOrDefault("displayName", null);
        double lat      = ((Number) body.get("latitude")).doubleValue();
        double lng      = ((Number) body.get("longitude")).doubleValue();
        double accuracy = body.containsKey("accuracy")
                        ? ((Number) body.get("accuracy")).doubleValue() : 0;
        return ResponseEntity.ok(trackingService.updateLocation(deviceId, name, lat, lng, accuracy));
    }

    @GetMapping("/active")
    public List<TrackedUser> getActive() {
        return trackingService.getActiveUsers();
    }

    @DeleteMapping("/{deviceId}")
    public ResponseEntity<Void> leave(@PathVariable String deviceId) {
        trackingService.deactivateUser(deviceId);
        return ResponseEntity.noContent().build();
    }
}
