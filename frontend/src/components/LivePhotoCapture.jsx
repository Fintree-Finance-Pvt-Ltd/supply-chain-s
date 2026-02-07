import React, { useRef, useState, useCallback } from 'react';
import Webcam from 'react-webcam';
import { FiCamera, FiRefreshCw, FiCheck, FiX } from 'react-icons/fi';

const LivePhotoCapture = ({ onCapture, onCancel, label = "Take Photo" }) => {
    const webcamRef = useRef(null);
    const [imageSrc, setImageSrc] = useState(null);
    const [facingMode, setFacingMode] = useState("user"); // "user" or "environment"

    const capture = useCallback(() => {
        const imageSrc = webcamRef.current.getScreenshot();
        setImageSrc(imageSrc);
    }, [webcamRef]);

    const retake = () => {
        setImageSrc(null);
    };

    const confirm = () => {
        if (imageSrc) {
            // Convert base64 to blob
            fetch(imageSrc)
                .then(res => res.blob())
                .then(blob => {
                    const file = new File([blob], `live_capture_${Date.now()}.jpg`, { type: "image/jpeg" });
                    onCapture(file);
                });
        }
    };

    const switchCamera = () => {
        setFacingMode(prev => prev === "user" ? "environment" : "user");
    };

    const videoConstraints = {
        facingMode: facingMode
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75 p-4">
            <div className="bg-white rounded-xl overflow-hidden shadow-2xl max-w-md w-full">
                <div className="bg-gray-900 text-white p-4 flex justify-between items-center">
                    <h3 className="font-semibold">{label}</h3>
                    <button onClick={onCancel} className="text-gray-400 hover:text-white"><FiX size={24} /></button>
                </div>

                <div className="relative bg-black h-80 flex items-center justify-center overflow-hidden">
                    {imageSrc ? (
                        <img src={imageSrc} alt="Captured" className="w-full h-full object-contain" />
                    ) : (
                        <Webcam
                            audio={false}
                            ref={webcamRef}
                            screenshotFormat="image/jpeg"
                            videoConstraints={videoConstraints}
                            className="w-full h-full object-cover"
                            mirrored={facingMode === "user"}
                        />
                    )}
                </div>

                <div className="p-6 flex justify-center space-x-6 bg-gray-50">
                    {imageSrc ? (
                        <>
                            <button
                                onClick={retake}
                                className="flex flex-col items-center space-y-1 text-gray-600 hover:text-red-500 transition-colors"
                            >
                                <div className="p-3 bg-white rounded-full shadow-sm border border-gray-200">
                                    <FiRefreshCw size={20} />
                                </div>
                                <span className="text-xs font-medium">Retake</span>
                            </button>
                            <button
                                onClick={confirm}
                                className="flex flex-col items-center space-y-1 text-green-600 hover:text-green-700 transition-colors"
                            >
                                <div className="p-3 bg-green-100 rounded-full shadow-sm border border-green-200">
                                    <FiCheck size={24} />
                                </div>
                                <span className="text-xs font-medium">Confirm</span>
                            </button>
                        </>
                    ) : (
                        <>
                            <button
                                onClick={switchCamera}
                                className="flex flex-col items-center space-y-1 text-gray-500 hover:text-gray-700 transition-colors absolute left-6 top-[22rem]"
                                title="Switch Camera"
                            >
                                <div className="p-2 bg-white/20 rounded-full backdrop-blur-sm text-white">
                                    <FiRefreshCw size={18} />
                                </div>
                            </button>

                            <button
                                onClick={capture}
                                className="flex flex-col items-center space-y-1 text-gray-700 group"
                            >
                                <div className="p-1 rounded-full border-4 border-gray-300 group-hover:border-primary-500 transition-colors">
                                    <div className="p-4 bg-primary-600 rounded-full text-white shadow-lg transform group-hover:scale-95 transition-transform">
                                        <FiCamera size={28} />
                                    </div>
                                </div>
                                <span className="text-xs font-medium mt-1">Capture</span>
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default LivePhotoCapture;
