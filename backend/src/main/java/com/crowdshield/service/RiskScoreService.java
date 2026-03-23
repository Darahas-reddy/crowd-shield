package com.crowdshield.service;

import com.crowdshield.model.Incident;
import com.crowdshield.model.Zone;
import com.crowdshield.repository.IncidentRepository;
import com.crowdshield.repository.ZoneHistoryRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Smart Crowd Density Classification Engine
 * ─────────────────────────────────────────
 * Computes a 0–100 riskScore per zone from 4 independent signals:
 *
 *  1. Density signal     (40 pts) — current occupancy % scaled non-linearly
 *  2. Trend signal       (25 pts) — rate of change over last 5 snapshots
 *  3. Time-of-day signal (15 pts) — peak-hour multiplier (17:00–22:00 = high risk)
 *  4. Incident signal    (20 pts) — open incidents in this zone in last 2 hours
 *
 * Classification:
 *   0–24  → LOW      (green)
 *  25–49  → MODERATE (yellow)
 *  50–74  → HIGH     (orange)
 *  75–89  → SEVERE   (red)
 *  90–100 → CRITICAL (red, flashing)
 */
@Service
@RequiredArgsConstructor
public class RiskScoreService {

    private final ZoneHistoryRepository historyRepo;
    private final IncidentRepository    incidentRepo;

    public Map<String, Object> score(Zone zone) {
        double density  = densitySignal(zone);
        double trend    = trendSignal(zone);
        double timeOfDay= timeSignal();
        double incident = incidentSignal(zone);

        double total = density + trend + timeOfDay + incident;
        int    score = (int) Math.min(100, Math.round(total));

        Map<String, Object> result = new HashMap<>();
        result.put("riskScore",       score);
        result.put("riskLevel",       classify(score));
        result.put("riskColor",       colorFor(score));
        result.put("densitySignal",   Math.round(density));
        result.put("trendSignal",     Math.round(trend));
        result.put("timeSignal",      Math.round(timeOfDay));
        result.put("incidentSignal",  Math.round(incident));
        result.put("recommendation",  recommend(score, zone));
        return result;
    }

    /** Scores all zones at once — used by the scheduler broadcast */
    public Map<String, Map<String, Object>> scoreAll(List<Zone> zones) {
        Map<String, Map<String, Object>> all = new HashMap<>();
        zones.forEach(z -> all.put(z.getId(), score(z)));
        return all;
    }

    // ── Signal 1: Density (0–40 pts) ─────────────────────────────────────
    private double densitySignal(Zone zone) {
        double pct = zone.getDensityPercentage();
        if (pct >= 100) return 40;
        if (pct >= 95)  return 38;
        if (pct >= 90)  return 34;
        if (pct >= 80)  return 28;
        if (pct >= 70)  return 20;
        if (pct >= 50)  return 12;
        if (pct >= 30)  return  6;
        return 2;
    }

    // ── Signal 2: Trend (0–25 pts) ──────────────────────────────────────
    // Measures rate of rise over the last 5 history snapshots
    private double trendSignal(Zone zone) {
        if (zone.getId() == null) return 0;
        var history = historyRepo.findByZoneIdAndRecordedAtAfterOrderByRecordedAtAsc(
                zone.getId(), LocalDateTime.now().minusMinutes(15));
        if (history.size() < 2) return 0;

        // Compare first and last snapshot density
        double first = history.get(0).getDensityPct();
        double last  = history.get(history.size() - 1).getDensityPct();
        double rise  = last - first;  // positive = increasing

        if (rise >= 30) return 25;
        if (rise >= 20) return 20;
        if (rise >= 10) return 14;
        if (rise >= 5)  return  8;
        if (rise >= 0)  return  3;
        return 0;  // falling trend = no risk contribution
    }

    // ── Signal 3: Time of day (0–15 pts) ────────────────────────────────
    // Peak hours: 17:00–23:00 = highest risk (events winding down)
    //             12:00–16:00 = moderate
    //             00:00–06:00 = low (late night, smaller crowds)
    private double timeSignal() {
        int hour = LocalDateTime.now().getHour();
        if (hour >= 17 && hour <= 22) return 15;
        if (hour >= 12 && hour <= 16) return  9;
        if (hour >= 23 || hour <= 1)  return  6;
        return 3;
    }

    // ── Signal 4: Incident signal (0–20 pts) ────────────────────────────
    private double incidentSignal(Zone zone) {
        if (zone.getId() == null) return 0;
        List<Incident> recent = incidentRepo.findByZoneId(zone.getId());
        LocalDateTime cutoff  = LocalDateTime.now().minusHours(2);

        long critical = recent.stream().filter(i ->
            i.getStatus() == Incident.IncidentStatus.OPEN &&
            i.getSeverity() == Incident.Severity.CRITICAL &&
            i.getReportedAt() != null && i.getReportedAt().isAfter(cutoff)
        ).count();

        long high = recent.stream().filter(i ->
            i.getStatus() == Incident.IncidentStatus.OPEN &&
            (i.getSeverity() == Incident.Severity.HIGH ||
             i.getSeverity() == Incident.Severity.MEDIUM) &&
            i.getReportedAt() != null && i.getReportedAt().isAfter(cutoff)
        ).count();

        double pts = (critical * 12) + (high * 5);
        return Math.min(20, pts);
    }

    // ── Classify ─────────────────────────────────────────────────────────
    private String classify(int score) {
        if (score >= 90) return "CRITICAL";
        if (score >= 75) return "SEVERE";
        if (score >= 50) return "HIGH";
        if (score >= 25) return "MODERATE";
        return "LOW";
    }

    private String colorFor(int score) {
        if (score >= 90) return "#f03e5e";
        if (score >= 75) return "#f03e5e";
        if (score >= 50) return "#f0832a";
        if (score >= 25) return "#f0b429";
        return "#34c472";
    }

    private String recommend(int score, Zone zone) {
        double pct = zone.getDensityPercentage();
        if (score >= 90) return "Activate evacuation immediately";
        if (score >= 75) return "Alert security — restrict new entries";
        if (score >= 50) return "Monitor closely — prepare crowd control";
        if (score >= 25) return "Watch for rapid increase";
        if (pct > 40)    return "Normal — capacity comfortable";
        return "All clear";
    }
}
