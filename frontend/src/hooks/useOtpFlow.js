import { useState } from "react";
import { toast } from "react-toastify";
import kycService from "../services/kycService";

export function useVerificationStatusesState() {
  return useState([]);
}

export default function useOtpFlow({
  customerId,
  formData,
  loadVerificationStatuses,
  navigate
}) {
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otpValue, setOtpValue] = useState("");
  const [otpData, setOtpData] = useState({
  target: "",
  value: "",
  type: "",
  ownerType: "COMPANY",
  applicantId: null,
  coApplicantId: null
});


  const [loadingStates, setLoadingStates] = useState({});
  const [isVerifying, setIsVerifying] = useState(false);

  const setLoading = (key, value) => {
    setLoadingStates(prev => ({ ...prev, [key]: value }));
  };

  const openOtpFor = ({
  type,
  target,
  value,
  ownerType,
  applicantId = null,
  coApplicantId = null
}) => {
  setOtpData({
    type,
    target,
    value,
    ownerType,
    applicantId,
    coApplicantId
  });
  setOtpValue("");
  setShowOtpModal(true);
};


  const closeOtpModal = () => {
    setShowOtpModal(false);
    setOtpValue("");
  };

  const handleOtpVerify = async () => {
  if (!otpValue || otpValue.length < 4) {
    toast.info("Enter valid OTP");
    return;
  }

  setIsVerifying(true);

  try {
    let res;

    // ----------------------------------
    // 🔹 MOBILE OTP VERIFY
    // ----------------------------------

    if (otpData.type === "mobile") {

      const companyInfo =
        !customerId && otpData.ownerType === "COMPANY"
          ? {
              companyType: formData.companyType,
              companyName: formData.companyName,
              rmId: 1 // 🔥 replace with auth user id later
            }
          : undefined;

      res = await kycService.verifyMobileOtp({
  customerId,
  otp: otpValue,
  mobileNumber: otpData.value,
  ownerType: otpData.ownerType,
  applicantId: otpData.applicantId,
  coApplicantId: otpData.coApplicantId,
  companyInfo
});


      // 🔥 If new customer created
      if (res?.success && res.customerId && !customerId) {
        closeOtpModal();
        navigate(`/rm/customer/new?id=${res.customerId}`, { replace: true });
        return;
      }

      if (res?.success && customerId) {
        await loadVerificationStatuses(customerId);
      }
    }

    // ----------------------------------
    // 🔹 EMAIL OTP VERIFY
    // ----------------------------------

    if (otpData.type === "email") {

      if (!customerId) {
        toast.info("Verify company mobile first.");
        return;
      }

      res = await kycService.verifyEmailOtp({
        customerId,
        otp: otpValue,
        ownerType: otpData.ownerType,
        applicantId: otpData.applicantId,
        coApplicantId: otpData.coApplicantId
      });

      if (res?.success) {
        await loadVerificationStatuses(customerId);
      }
    }

    if (res?.success) {
  if (customerId) {
    await loadVerificationStatuses(customerId);
  }
  closeOtpModal();
  toast.success("OTP verified successfully");
}


  } catch (e) {
    toast.error(
      "OTP verification failed: " +
        (e?.response?.data?.message || e.message)
    );
  } finally {
    setIsVerifying(false);
  }
};


  return {
    showOtpModal,
    otpValue,
    setOtpValue,
    otpData,
    loadingStates,
    isVerifying,
    openOtpFor,
    closeOtpModal,
    handleOtpVerify,
    setLoading
  };
}

useOtpFlow.useVerificationStatusesState = useVerificationStatusesState;
