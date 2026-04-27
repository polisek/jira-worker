import type { FC } from 'react'
import { wrap } from '../../utils/globals'
import CreateIssueModalView from './views/CreateIssueModalView'
import useCreateIssueModal, { type useCreateIssueModalProps } from './hooks/useCreateIssueModal'

const CreateIssueModal: FC<useCreateIssueModalProps> = wrap(CreateIssueModalView, useCreateIssueModal)
export { CreateIssueModal }
export default CreateIssueModal
