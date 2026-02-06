import { useState } from 'react'
import { FiX, FiUpload } from 'react-icons/fi'
import kycService from '../services/kycService'

const CoApplicantForm = ({
    index,
    data = {},
    onChange,
    onRemove,
    onPanUpload,
    kycData = {},
    errors = {}
}) => {
    const [isOcrProcessing, setIsOcrProcessing] = useState(false)
    const [isVerifying, setIsVerifying] = useState(false)

    const handlePanImageUpload = async (e) => {
        const file = e.target.files[0]
        if (!file) return

        setIsOcrProcessing(true)
        try {
            // Call placeholder OCR
            const result = await kycService.runPanOcr(file)
            if (result.success) {
                // Auto-fill PAN number and name
                onChange(index, {
                    ...data,
                    name: result.data.name,
                })

                // Store PAN separately (would be saved to backend)
                if (onPanUpload) {
                    onPanUpload(index, file, result.data.panNumber)
                }

                alert(`OCR completed! PAN: ${result.data.panNumber}, Name: ${result.data.name}`)
            }
        } catch (error) {
            alert('OCR failed: ' + error.message)
        } finally {
            setIsOcrProcessing(false)
        }
    }

    const handlePanVerify = async () => {
        if (!kycData.panNumber) {
            alert('Please upload PAN first')
            return
        }

        setIsVerifying(true)
        try {
            const result = await kycService.verifyPan(kycData.panNumber)
            if (result.success) {
                alert(result.message || 'PAN verified successfully')
            }
        } catch (error) {
            alert('PAN verification failed: ' + error.message)
        } finally {
            setIsVerifying(false)
        }
    }

    const handleMobileVerify = async () => {
        if (!data.mobile) {
            alert('Please enter mobile number first')
            return
        }

        setIsVerifying(true)
        try {
            const result = await kycService.verifyMobile(data.mobile)
            if (result.success) {
                alert(result.message || 'Mobile verified successfully')
            }
        } catch (error) {
            alert('Mobile verification failed: ' + error.message)
        } finally {
            setIsVerifying(false)
        }
    }

    const handleEmailVerify = async () => {
        if (!data.email) {
            alert('Please enter email first')
            return
        }

        setIsVerifying(true)
        try {
            const result = await kycService.verifyEmail(data.email)
            if (result.success) {
                alert(result.message || 'Email verified successfully')
            }
        } catch (error) {
            alert('Email verification failed: ' + error.message)
        } finally {
            setIsVerifying(false)
        }
    }

    const handleAadhaarKyc = async () => {
        setIsVerifying(true)
        try {
            const result = await kycService.initiateAadhaarKyc(data.aadhaarNumber || '')
            if (result.success) {
                alert(result.message || 'Aadhaar KYC initiated successfully')
            }
        } catch (error) {
            alert('Aadhaar KYC failed: ' + error.message)
        } finally {
            setIsVerifying(false)
        }
    }

    return (
        <div className="border border-gray-300 rounded-lg p-6 mb-4 bg-gray-50 relative">
            <button
                type="button"
                onClick={() => onRemove(index)}
                className="absolute top-4 right-4 p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded"
                title="Remove Co-Applicant"
            >
                <FiX className="h-5 w-5" />
            </button>

            <h4 className="text-lg font-semibold text-gray-900 mb-4">
                Co-Applicant {index + 1}
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Name */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Name <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="text"
                        value={data.name || ''}
                        onChange={(e) => onChange(index, { ...data, name: e.target.value })}
                        className="input-field"
                        placeholder="Enter co-applicant name"
                    />
                    {errors.name && (
                        <p className="text-red-500 text-xs mt-1">{errors.name}</p>
                    )}
                </div>

                {/* Mobile */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Mobile Number <span className="text-red-500">*</span>
                    </label>
                    <div className="flex space-x-2">
                        <input
                            type="tel"
                            value={data.mobile || ''}
                            onChange={(e) => onChange(index, { ...data, mobile: e.target.value })}
                            className="input-field flex-1"
                            placeholder="Enter mobile number"
                            maxLength={10}
                        />
                        <button
                            type="button"
                            onClick={handleMobileVerify}
                            disabled={isVerifying}
                            className="btn-secondary whitespace-nowrap"
                        >
                            {isVerifying ? 'Verifying...' : 'Verify'}
                        </button>
                    </div>
                    {errors.mobile && (
                        <p className="text-red-500 text-xs mt-1">{errors.mobile}</p>
                    )}
                </div>

                {/* Email */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Email
                    </label>
                    <div className="flex space-x-2">
                        <input
                            type="email"
                            value={data.email || ''}
                            onChange={(e) => onChange(index, { ...data, email: e.target.value })}
                            className="input-field flex-1"
                            placeholder="Enter email address"
                        />
                        <button
                            type="button"
                            onClick={handleEmailVerify}
                            disabled={isVerifying}
                            className="btn-secondary whitespace-nowrap"
                        >
                            {isVerifying ? 'Verifying...' : 'Verify'}
                        </button>
                    </div>
                </div>

                {/* Gender */}
                <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Gender <span className="text-red-500">*</span>
                    </label>
                    <div className="flex space-x-6 mt-2">
                        {['Male', 'Female', 'Other'].map((gender) => (
                            <label key={gender} className="inline-flex items-center cursor-pointer">
                                <input
                                    type="radio"
                                    name={`gender-${index}`}
                                    value={gender}
                                    checked={data.gender === gender}
                                    onChange={(e) => onChange(index, { ...data, gender: e.target.value })}
                                    className="form-radio h-4 w-4 text-primary-600 border-gray-300 focus:ring-primary-500"
                                />
                                <span className="ml-2 text-sm text-gray-700">{gender}</span>
                            </label>
                        ))}
                    </div>
                </div>

                {/* PAN Upload */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        PAN Card <span className="text-red-500">*</span>
                    </label>
                    <div className="flex space-x-2">
                        <label className="flex-1 cursor-pointer">
                            <input
                                type="file"
                                accept="image/*,.pdf"
                                onChange={handlePanImageUpload}
                                className="hidden"
                            />
                            <div className="input-field flex items-center justify-center space-x-2 border-dashed">
                                <FiUpload className="h-4 w-4" />
                                <span className="text-sm">
                                    {isOcrProcessing ? 'Processing...' : 'Upload PAN'}
                                </span>
                            </div>
                        </label>
                        <button
                            type="button"
                            onClick={handlePanVerify}
                            disabled={isVerifying || !kycData.panNumber}
                            className="btn-secondary whitespace-nowrap"
                        >
                            {isVerifying ? 'Verifying...' : 'Verify'}
                        </button>
                    </div>
                    {kycData.panNumber && (
                        <p className="text-xs text-green-600 mt-1">PAN: {kycData.panNumber}</p>
                    )}
                </div>

                {/* Aadhaar KYC */}
                <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Aadhaar KYC <span className="text-red-500">*</span>
                    </label>
                    <button
                        type="button"
                        onClick={handleAadhaarKyc}
                        disabled={isVerifying}
                        className="btn-primary"
                    >
                        {isVerifying ? 'Processing...' : 'Complete Aadhaar KYC'}
                    </button>
                    <p className="text-xs text-gray-500 mt-1">
                        This will initiate Aadhaar-based e-KYC verification
                    </p>
                </div>
            </div>
        </div>
    )
}

export default CoApplicantForm
