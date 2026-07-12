import { demoRepository } from './demoRepository'

const resourceRepository = (key: 'intelligence' | 'indicatorProposals' | 'disclosureDecisions' | 'reportSchedules' | 'apiKeys' | 'institutionApplications') => ({
  list: () => demoRepository.getSnapshot()[key],
  save(record: Record<string, unknown>) { demoRepository.update(state => ({ ...state, [key]: [...state[key], record] })) },
})

export const intelligenceRepository = resourceRepository('intelligence')
export const indicatorRepository = resourceRepository('indicatorProposals')
export const disclosureRepository = resourceRepository('disclosureDecisions')
export const reportRepository = resourceRepository('reportSchedules')
export const integrationRepository = resourceRepository('apiKeys')
export const institutionRepository = resourceRepository('institutionApplications')
