package com.crowdshield.model;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import java.time.LocalDateTime;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "zones")
public class Zone {

    @Id
    private String id;

    private String name;
    private String location;
    private int capacity;
    private int currentCount;

    // Centre point (used for circle zones & map display)
    private double latitude;
    private double longitude;

    private ZoneStatus status;
    private LocalDateTime lastUpdated;

    // ── Shape type ─────────────────────────────────────────────────
    // "circle"  → use latitude/longitude + radiusMetres
    // "polygon" → use polygonCoords list
    private String shapeType = "circle";

    // Circle
    private double radiusMetres = 200.0;

    // Polygon — list of [lat, lng] pairs drawn by user on map
    // e.g. [[17.385, 78.486], [17.386, 78.487], [17.384, 78.488]]
    private List<List<Double>> polygonCoords;

    // Computed area in sq metres (set when zone is saved)
    private double areaSquareMetres;

    public enum ZoneStatus {
        SAFE, WARNING, CRITICAL, EVACUATING
    }

    public double getDensityPercentage() {
        return capacity > 0 ? (double) currentCount / capacity * 100 : 0;
    }
}
