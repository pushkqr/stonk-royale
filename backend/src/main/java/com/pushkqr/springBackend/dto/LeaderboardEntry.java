package com.pushkqr.springBackend.dto;

import com.pushkqr.springBackend.entities.Holding;
import com.pushkqr.springBackend.entities.User;

import java.util.ArrayList;
import java.util.List;

public class LeaderboardEntry {
    public User user;
    public Double netWorth;
    public Double pnl;
    public Double availableCash;
    public Double cryptoValue;
    public List<Holding> holdings;

    public LeaderboardEntry() {
    }

    public LeaderboardEntry(User user, Double cryptoValue, Double availableCash, Double pnl, Double netWorth, List<Holding> holdings) {
        this.user = user;
        this.cryptoValue = cryptoValue;
        this.availableCash = availableCash;
        this.pnl = pnl;
        this.netWorth = netWorth;
        this.holdings = holdings;
    }

    public User getUser() {
        return user;
    }

    public void setUser(User user) {
        this.user = user;
    }

    public Double getCryptoValue() {
        return cryptoValue;
    }

    public void setCryptoValue(Double cryptoValue) {
        this.cryptoValue = cryptoValue;
    }

    public Double getAvailableCash() {
        return availableCash;
    }

    public void setAvailableCash(Double availableCash) {
        this.availableCash = availableCash;
    }

    public Double getPnl() {
        return pnl;
    }

    public void setPnl(Double pnl) {
        this.pnl = pnl;
    }

    public Double getNetWorth() {
        return netWorth;
    }

    public void setNetWorth(Double netWorth) {
        this.netWorth = netWorth;
    }

    public List<Holding> getHoldings() {
        return holdings;
    }

    public void setHoldings(List<Holding> holdings) {
        this.holdings = holdings;
    }
}
