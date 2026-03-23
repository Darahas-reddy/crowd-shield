package com.crowdshield.dto.request;

import com.crowdshield.model.Incident;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record IncidentRequest(
    String zoneId,

    @NotBlank(message = "Incident title is required")
    @Size(min = 3, max = 120)
    String title,

    @Size(max = 500)
    String description,

    @NotNull(message = "Incident type is required")
    Incident.IncidentType type,

    @NotNull(message = "Severity is required")
    Incident.Severity severity,

    String reportedBy
) {}
