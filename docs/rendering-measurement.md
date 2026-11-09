# Rendering measurement

The build includes an opt-in local recorder. It is a measurement tool, not evidence that any hardware has passed.

On the agreed lowest-spec company laptop, append `&measure=1` to the private invitation URL. Use the target game area, record its CSS dimensions, and record the exact hardware, OS, browser version, display refresh rate, network profile, source commit, content hash, and workload. Use representative player presence and interactions throughout the event.

The recorder counts game render-loop callbacks in completed one-second windows during visible chapter and finale play. A visible main-thread stall contributes low- or zero-frame windows. Hidden tabs, pauses, non-play phases, and incomplete boundary windows are excluded. The report includes raw windows, measured seconds, and the percentage reaching 30 callbacks per second. This measures browser rendering cadence, not GPU presentation timestamps.

At the end, click **QA: download frame measurements**. The JSON is created locally; nothing is sent to a telemetry service. Preserve the file with the environment record and disclose any excluded intervals or unusual background activity. A short sample or a development workstation cannot establish the required 95% target on the agreed laptop.

The pure recorder test verifies long-stall accounting and hidden/paused exclusions. It does not render the game or supply a hardware result. Without `measure=1`, the recorder is inactive and no QA control appears.
