import { demoRepository } from './demoRepository'
export const auditRepository = { list: () => demoRepository.getSnapshot().auditEvents, create: demoRepository.addAudit.bind(demoRepository) }

