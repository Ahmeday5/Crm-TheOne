/**
 * Public surface of the command center (Ctrl+K, shortcuts, tour, PWA prompts).
 * The shell mounts `CommandCenterHostComponent` once and the header shows
 * `CommandTriggerComponent`; nothing else imports the internals.
 */
export { CommandCenterHostComponent } from './components/command-center-host/command-center-host.component';
export { CommandTriggerComponent } from './components/command-trigger/command-trigger.component';
export { TourService } from './services/tour.service';
export { CommandCenterUiService } from './services/command-center-ui.service';
