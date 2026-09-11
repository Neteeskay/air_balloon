# Demo script for the jury

This is a short live-show path. Use `anna / balloon1` unless another profile is needed.

1. Open the frontend and log in.
2. Show the profile and current balance.
3. Show both `GREEN` and `RED` game choices.
4. Select each of the four paired stake + booster variants.
5. Start a `GREEN` round.
6. Let the level indicator advance.
7. Show the booster activation, visual treatment, sound, and points.
8. Cash out after a level is available.
9. Show that the flight continues after cashout.
10. Let the round crash and open the result.
11. Point out actual win, potential maximum, points, reward, and the approximately 10-second return to setup.
12. Start one `RED` round and do not cash out; show the `LOSS` result, stake debit, score, balance, and history entry.
13. Open History and switch between `Все игроки` and `Мои игры`.
14. Open Tournament and show the top three, current player, timer, and live score update.
15. Show reconnect recovery during an active round and reload the page to show state recovery.
16. Run the mandatory S5 demo using the existing protected runtime-config workflow:
    - note the current `pointsPerLevel`;
    - change it through the protected config workflow;
    - start a new round and show the new points value;
    - restore the original value before finishing.

## First-run onboarding

For the onboarding portion, use a fresh browser profile/localStorage. On the first completed cashout, show the cashout onboarding hint. Wait approximately four seconds for it to disappear, then start another round and confirm it does not incorrectly repeat.

## Sound and mute

During booster activation, demonstrate sound with mute `OFF`, toggle mute `ON`, and toggle it back `OFF`. The visual booster state and points must remain correct while mute is enabled.

## Safety reset before the show

If a previous demo left an active session or changed runtime configuration, reload the page, log in again, and verify the original runtime configuration before the jury starts.
