package com.crowdshield.repository;

import com.crowdshield.model.Incident;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface IncidentRepository extends MongoRepository<Incident, String> {
    List<Incident> findByZoneId(String zoneId);
    List<Incident> findByStatus(Incident.IncidentStatus status);
    List<Incident> findBySeverity(Incident.Severity severity);
    List<Incident> findAllByOrderByReportedAtDesc();
    long countByStatus(Incident.IncidentStatus status);
}
