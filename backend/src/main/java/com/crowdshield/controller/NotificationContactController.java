package com.crowdshield.controller;

import com.crowdshield.model.NotificationContact;
import com.crowdshield.service.NotificationContactService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/contacts")
@RequiredArgsConstructor
public class NotificationContactController {

    private final NotificationContactService contactService;

    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    public List<NotificationContact> getAll() { return contactService.getAll(); }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    @ResponseStatus(HttpStatus.CREATED)
    public NotificationContact create(@RequestBody NotificationContact c) { return contactService.save(c); }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public NotificationContact update(@PathVariable String id, @RequestBody NotificationContact c) {
        return contactService.update(id, c);
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable String id) { contactService.delete(id); }

    @PostMapping("/{id}/test")
    @PreAuthorize("hasRole('ADMIN')")
    public void test(@PathVariable String id) { contactService.sendTest(id); }
}
