package com.crowdshield.controller;

import com.crowdshield.dto.response.AlertResponse;
import com.crowdshield.service.AlertService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/alerts")
@RequiredArgsConstructor
public class AlertController {

    private final AlertService alertService;

    @GetMapping
    public List<AlertResponse> getAllAlerts() {
        return alertService.getAllAlerts().stream().map(AlertResponse::from).toList();
    }

    @GetMapping("/unacknowledged")
    public List<AlertResponse> getUnacknowledged() {
        return alertService.getUnacknowledgedAlerts().stream().map(AlertResponse::from).toList();
    }

    @GetMapping("/count")
    public Map<String, Long> getCount() {
        return Map.of("unacknowledged", alertService.getUnacknowledgedCount());
    }

    @PatchMapping("/{id}/acknowledge")
    @PreAuthorize("hasAnyRole('ADMIN','USER')")
    public AlertResponse acknowledge(@PathVariable String id) {
        return AlertResponse.from(alertService.acknowledgeAlert(id));
    }

    @PostMapping("/acknowledge-all")
    @PreAuthorize("hasAnyRole('ADMIN','USER')")
    public ResponseEntity<Void> acknowledgeAll() {
        alertService.acknowledgeAll();
        return ResponseEntity.ok().build();
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> deleteAlert(@PathVariable String id) {
        alertService.deleteAlert(id);
        return ResponseEntity.noContent().build();
    }
}
