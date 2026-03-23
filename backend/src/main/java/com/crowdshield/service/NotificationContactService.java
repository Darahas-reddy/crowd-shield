package com.crowdshield.service;

import com.crowdshield.exception.ResourceNotFoundException;
import com.crowdshield.model.NotificationContact;
import com.crowdshield.repository.NotificationContactRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import java.util.List;

@Service
@RequiredArgsConstructor
public class NotificationContactService {

    private final NotificationContactRepository repo;
    private final TwilioNotificationService      twilioService;

    public List<NotificationContact> getAll() { return repo.findAll(); }

    public NotificationContact save(NotificationContact c) { return repo.save(c); }

    public NotificationContact update(String id, NotificationContact updated) {
        return repo.findById(id).map(c -> {
            c.setName(updated.getName()); c.setPhone(updated.getPhone());
            c.setSmsEnabled(updated.isSmsEnabled()); c.setWhatsappEnabled(updated.isWhatsappEnabled());
            c.setNotifyOn(updated.getNotifyOn()); c.setActive(updated.isActive());
            return repo.save(c);
        }).orElseThrow(() -> new ResourceNotFoundException("Contact", id));
    }

    public void delete(String id) {
        if (!repo.existsById(id)) throw new ResourceNotFoundException("Contact", id);
        repo.deleteById(id);
    }

    public void sendTest(String id) { twilioService.sendTest(id); }
}
