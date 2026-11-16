import { Provider } from '@angular/core';
import { MockProjectBuildsGateway } from './mock-project-builds-gateway';
import { ProjectBuildsGateway } from './project-builds-gateway';

/**
 * The single switch between build-archive adapters.
 *
 * Today: the in-memory mock (design preview). When the HTTP adapter is written
 * (`HttpProjectBuildsGateway extends ProjectBuildsGateway`, calling
 * `ManagerProjects/{id}/developers` and `.../builds`), bind it here instead —
 * nothing in the components changes.
 */
export function provideProjectBuildsGateway(): Provider[] {
  return [
    MockProjectBuildsGateway,
    { provide: ProjectBuildsGateway, useExisting: MockProjectBuildsGateway },
  ];
}
