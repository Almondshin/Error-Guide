package com.mobileok.identity.infrastructure;

import org.springframework.stereotype.Component;

@Component
public class LogMasking {

    public String maskName(String name) {
        if (name == null || name.length() < 2) {
            return name;
        }
        // F*L (e.g., 홍*동)
        char first = name.charAt(0);
        char last = name.charAt(name.length() - 1);
        return first + "*" + last;
    }

    public String maskPhone(String phone) {
        if (phone == null || !phone.contains("-")) {
            return phone;
        }
        // 010-****-1234
        String[] parts = phone.split("-");
        if (parts.length == 3) {
            return parts[0] + "-****-" + parts[2];
        }
        return phone;
    }

    public String maskBirthday(String birthday) {
        if (birthday == null || !birthday.contains("-")) {
            return birthday;
        }
        // 1990-**-**
        String[] parts = birthday.split("-");
        if (parts.length == 3) {
            return parts[0] + "-**-**";
        }
        return birthday;
    }
}
