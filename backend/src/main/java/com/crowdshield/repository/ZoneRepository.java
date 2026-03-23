package com.crowdshield.repository;

import com.crowdshield.model.Zone;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface ZoneRepository extends MongoRepository<Zone, String> {
    List<Zone> findByStatus(Zone.ZoneStatus status);
    List<Zone> findByLocation(String location);
}
