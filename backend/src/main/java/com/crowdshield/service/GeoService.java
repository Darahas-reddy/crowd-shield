package com.crowdshield.service;

import com.crowdshield.model.Zone;
import org.springframework.stereotype.Service;
import java.util.List;

/**
 * Geometry utilities for geofencing:
 *  - Point-in-polygon (Ray Casting algorithm)
 *  - Point-in-circle (Haversine)
 *  - Polygon area (Shoelace formula on spherical coords)
 */
@Service
public class GeoService {

    private static final double EARTH_RADIUS = 6371000.0; // metres

    /** Returns true if the GPS point is inside the zone boundary */
    public boolean isInsideZone(double lat, double lng, Zone zone) {
        if ("polygon".equals(zone.getShapeType())) {
            List<List<Double>> coords = zone.getPolygonCoords();
            if (coords == null || coords.size() < 3) return false;
            return pointInPolygon(lat, lng, coords);
        } else {
            // Default: circle
            double radius = zone.getRadiusMetres() > 0 ? zone.getRadiusMetres() : 200.0;
            double dist = haversineMetres(lat, lng, zone.getLatitude(), zone.getLongitude());
            return dist <= radius;
        }
    }

    /**
     * Ray Casting algorithm for point-in-polygon.
     * Works accurately for small geographic areas (< ~50km).
     * coords: list of [lat, lng] pairs forming a closed polygon.
     */
    public boolean pointInPolygon(double lat, double lng, List<List<Double>> coords) {
        int n = coords.size();
        boolean inside = false;
        int j = n - 1;
        for (int i = 0; i < n; i++) {
            double xi = coords.get(i).get(1); // lng = x
            double yi = coords.get(i).get(0); // lat = y
            double xj = coords.get(j).get(1);
            double yj = coords.get(j).get(0);
            boolean intersect = ((yi > lat) != (yj > lat))
                    && (lng < (xj - xi) * (lat - yi) / (yj - yi) + xi);
            if (intersect) inside = !inside;
            j = i;
        }
        return inside;
    }

    /** Haversine distance in metres between two GPS points */
    public static double haversineMetres(double lat1, double lon1, double lat2, double lon2) {
        double dLat = Math.toRadians(lat2 - lat1);
        double dLon = Math.toRadians(lon2 - lon1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
                * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        return EARTH_RADIUS * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    /**
     * Approximate polygon area in square metres using the Shoelace formula
     * projected onto a local flat plane (accurate for zones < ~10km wide).
     */
    public double polygonAreaSquareMetres(List<List<Double>> coords) {
        if (coords == null || coords.size() < 3) return 0;
        int n = coords.size();
        double area = 0;
        for (int i = 0; i < n; i++) {
            int j = (i + 1) % n;
            double latI = Math.toRadians(coords.get(i).get(0));
            double lngI = Math.toRadians(coords.get(i).get(1));
            double latJ = Math.toRadians(coords.get(j).get(0));
            double lngJ = Math.toRadians(coords.get(j).get(1));
            // Project to metres using equirectangular approximation
            double x1 = EARTH_RADIUS * lngI * Math.cos((latI + latJ) / 2);
            double y1 = EARTH_RADIUS * latI;
            double x2 = EARTH_RADIUS * lngJ * Math.cos((latI + latJ) / 2);
            double y2 = EARTH_RADIUS * latJ;
            area += (x1 * y2 - x2 * y1);
        }
        return Math.abs(area / 2.0);
    }

    /** Circle area in square metres */
    public double circleAreaSquareMetres(double radiusMetres) {
        return Math.PI * radiusMetres * radiusMetres;
    }

    /** Compute centroid of a polygon (for map display label placement) */
    public double[] polygonCentroid(List<List<Double>> coords) {
        double lat = 0, lng = 0;
        for (List<Double> p : coords) { lat += p.get(0); lng += p.get(1); }
        return new double[]{ lat / coords.size(), lng / coords.size() };
    }
}
