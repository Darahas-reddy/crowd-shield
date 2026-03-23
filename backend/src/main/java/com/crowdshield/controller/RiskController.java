package com.crowdshield.controller;

import com.crowdshield.exception.ResourceNotFoundException;
import com.crowdshield.service.RiskScoreService;
import com.crowdshield.service.ZoneService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/risk")
@RequiredArgsConstructor
public class RiskController {

    private final RiskScoreService riskScoreService;
    private final ZoneService      zoneService;

    @GetMapping("/zones")
    public Map<String, Map<String, Object>> allZoneRisks() {
        return riskScoreService.scoreAll(zoneService.getAllZones());
    }

    @GetMapping("/zones/{id}")
    public Map<String, Object> zoneRisk(@PathVariable String id) {
        return zoneService.getZoneById(id)
            .map(riskScoreService::score)
            .orElseThrow(() -> new ResourceNotFoundException("Zone", id));
    }
}
