package ru.hackathon.airballoon.tournament.config;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

@Validated
@ConfigurationProperties("tournament")
public class TournamentProperties {
    private boolean maskOtherPlayerNames = true;
    @Min(3) @Max(100) private int liveTopSize = 20;
    private boolean demoTournamentSimulationEnabled = false;
    public boolean isMaskOtherPlayerNames() { return maskOtherPlayerNames; }
    public void setMaskOtherPlayerNames(boolean value) { maskOtherPlayerNames = value; }
    public int getLiveTopSize() { return liveTopSize; }
    public void setLiveTopSize(int value) { liveTopSize = value; }
    public boolean isDemoTournamentSimulationEnabled() { return demoTournamentSimulationEnabled; }
    public void setDemoTournamentSimulationEnabled(boolean value) { demoTournamentSimulationEnabled = value; }
}
