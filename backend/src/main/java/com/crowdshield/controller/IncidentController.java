package com.crowdshield.controller;

import com.crowdshield.dto.request.IncidentRequest;
import com.crowdshield.dto.response.IncidentResponse;
import com.crowdshield.exception.ResourceNotFoundException;
import com.crowdshield.model.Incident;
import com.crowdshield.service.IncidentService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/incidents")
@RequiredArgsConstructor
public class IncidentController {

    private final IncidentService incidentService;

    @GetMapping
    public List<IncidentResponse> getAllIncidents() {
        return incidentService.getAllIncidents().stream().map(IncidentResponse::from).toList();
    }

    @GetMapping("/{id}")
    public IncidentResponse getIncident(@PathVariable String id) {
        return incidentService.getIncidentById(id)
            .map(IncidentResponse::from)
            .orElseThrow(() -> new ResourceNotFoundException("Incident", id));
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN','USER')")
    @ResponseStatus(HttpStatus.CREATED)
    public IncidentResponse createIncident(@Valid @RequestBody IncidentRequest req) {
        return IncidentResponse.from(incidentService.createIncident(toModel(req)));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','USER')")
    public IncidentResponse updateIncident(@PathVariable String id,
                                           @Valid @RequestBody IncidentRequest req) {
        return IncidentResponse.from(incidentService.updateIncident(id, toModel(req)));
    }

    @PatchMapping("/{id}/resolve")
    @PreAuthorize("hasAnyRole('ADMIN','USER')")
    public IncidentResponse resolveIncident(@PathVariable String id) {
        return IncidentResponse.from(incidentService.resolveIncident(id));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteIncident(@PathVariable String id) {
        incidentService.deleteIncident(id);
    }

    @GetMapping("/zone/{zoneId}")
    public List<IncidentResponse> getByZone(@PathVariable String zoneId) {
        return incidentService.getIncidentsByZone(zoneId).stream().map(IncidentResponse::from).toList();
    }

    @GetMapping("/open")
    public List<IncidentResponse> getOpenIncidents() {
        return incidentService.getOpenIncidents().stream().map(IncidentResponse::from).toList();
    }

    private Incident toModel(IncidentRequest r) {
        Incident i = new Incident();
        i.setZoneId(r.zoneId());
        i.setTitle(r.title());
        i.setDescription(r.description());
        i.setType(r.type());
        i.setSeverity(r.severity());
        i.setReportedBy(r.reportedBy());
        return i;
    }
}
