package com.crowdshield.dto.response;

import com.crowdshield.model.Incident;

import java.time.LocalDateTime;

public record IncidentResponse(
    String                   id,
    String                   zoneId,
    String                   zoneName,
    String                   title,
    String                   description,
    Incident.IncidentType    type,
    Incident.Severity        severity,
    Incident.IncidentStatus  status,
    String                   reportedBy,
    LocalDateTime            reportedAt,
    LocalDateTime            resolvedAt,
    String                   resolutionNotes
) {
    public static IncidentResponse from(Incident i) {
        return new IncidentResponse(
            i.getId(), i.getZoneId(), i.getZoneName(),
            i.getTitle(), i.getDescription(), i.getType(),
            i.getSeverity(), i.getStatus(), i.getReportedBy(),
            i.getReportedAt(), i.getResolvedAt(), i.getResolutionNotes()
        );
    }
}
