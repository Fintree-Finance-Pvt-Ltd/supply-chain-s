import { useState } from 'react'
import kycService from '../services/kycService'

export const VERIFICATION_STATE = {
    IDLE: 'IDLE',
    SENDING: 'SENDING',
    VERIFYING: 'VERIFYING',
    VERIFIED: 'VERIFIED',
    FAILED: 'FAILED'
}

export default function useVerification(caseId, refreshStatuses) {
    const [states, setStates] = useState({})

    const setState = (key, value) => {
        setStates(prev => ({ ...prev, [key]: value }))
    }

    const verify = async ({ key, type, value, meta }) => {
        if (!value || states[key] === VERIFICATION_STATE.VERIFIED) return
        if (states[key] === VERIFICATION_STATE.SENDING) return

        setState(key, VERIFICATION_STATE.SENDING)

        try {
            let result

            switch (type) {
                case 'PAN':
                    result = await kycService.verifyPan(caseId, value, meta?.name, meta?.coApplicantId)
                    break
                case 'GST':
                    result = await kycService.verifyGst(caseId, value)
                    break
                case 'MOBILE':
                    result = await kycService.sendMobileOtp(caseId, value)
                    break
                case 'EMAIL':
                    result = await kycService.sendEmailOtp(caseId, value)
                    break
                default:
                    return
            }

            if (result.success) {
                setState(key, VERIFICATION_STATE.VERIFIED)
                refreshStatuses?.()
            } else {
                setState(key, VERIFICATION_STATE.FAILED)
            }

        } catch (err) {
            setState(key, VERIFICATION_STATE.FAILED)
        }
    }

    return {
        states,
        verify
    }
}
