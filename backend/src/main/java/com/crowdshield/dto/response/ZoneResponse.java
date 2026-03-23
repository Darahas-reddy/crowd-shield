package com.crowdshield.dto.response;

import com.crowdshield.model.Zone;

import java.time.LocalDateTime;
import java.util.List;

public record ZoneResponse(
    String              id,
    String              name,
    String              location,
    int                 capacity,
    int                 currentCount,
    double              densityPercentage,
    double              latitude,
    double              longitude,
    String              shapeType,
    double              radiusMetres,
    List<List<Double>>  polygonCoords,
    double              areaSquareMetres,
    Zone.ZoneStatus     status,
    LocalDateTime       lastUpdated
) {
    public static ZoneResponse from(Zone z) {
        return new ZoneResponse(
            z.getId(), z.getName(), z.getLocation(),
            z.getCapacity(), z.getCurrentCount(), z.getDensityPercentage(),
            z.getLatitude(), z.getLongitude(),
            z.getShapeType(), z.getRadiusMetres(), z.getPolygonCoords(),
            z.getAreaSquareMetres(), z.getStatus(), z.getLastUpdated()
        );
    }
}
