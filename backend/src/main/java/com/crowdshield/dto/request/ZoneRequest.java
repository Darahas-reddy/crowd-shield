package com.crowdshield.dto.request;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.util.List;

public record ZoneRequest(
    @NotBlank(message = "Zone name is required")
    @Size(min = 2, max = 80)
    String name,

    @NotBlank(message = "Location label is required")
    String location,

    @Min(1) @Max(500000)
    int capacity,

    double latitude,
    double longitude,
    String shapeType,
    double radiusMetres,
    List<List<Double>> polygonCoords
) {}
