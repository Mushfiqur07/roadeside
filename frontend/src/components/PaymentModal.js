import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  CreditCard, 
  Smartphone, 
  Banknote, 
  CheckCircle, 
  AlertCircle,
  Loader2,
  Download,
  Eye,
  EyeOff
} from 'lucide-react';
import toast from 'react-hot-toast';
import { paymentsAPI } from '../api/payments';

const PaymentModal = ({ 
  isOpen, 
  onClose, 
  amount, 
  requestId, 
  onPaymentSuccess,
  onPaymentError,
  minAmount, // optional lower bound of allowed range
  maxAmount  // optional upper bound of allowed range
}) => {
  const [selectedMethod, setSelectedMethod] = useState('bkash');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [pin, setPin] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [cvv, setCvv] = useState('');
  const [cardholderName, setCardholderName] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [showCvv, setShowCvv] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [amountInput, setAmountInput] = useState('');
  const [errorText, setErrorText] = useState('');
  const [step, setStep] = useState(1); // 1: method selection, 2: payment details, 3: processing, 4: success

  const paymentMethods = [
    {
      id: 'bkash',
      name: 'bKash',
      icon: '📱',
      color: '#E2136E',
      bgColor: '#FDF2F8',
      description: 'Pay with bKash mobile wallet',
      logo: 'bKash'
    },
    {
      id: 'nagad',
      name: 'Nagad',
      icon: '📱',
      color: '#DC2626',
      bgColor: '#FEF2F2',
      description: 'Pay with Nagad mobile wallet',
      logo: 'Nagad'
    },
    {
      id: 'rocket',
      name: 'Rocket',
      icon: '📱',
      color: '#2563EB',
      bgColor: '#EFF6FF',
      description: 'Pay with Rocket mobile wallet',
      logo: 'Rocket'
    },
    {
      id: 'card',
      name: 'Card',
      icon: '💳',
      color: '#059669',
      bgColor: '#ECFDF5',
      description: 'Pay with credit/debit card',
      logo: 'Card'
    },
    {
      id: 'cash',
      name: 'Cash',
      icon: '💵',
      color: '#D97706',
      bgColor: '#FFFBEB',
      description: 'Pay with cash on delivery',
      logo: 'Cash'
    }
  ];

  const selectedPaymentMethod = paymentMethods.find(method => method.id === selectedMethod);

  const handleMethodSelect = (methodId) => {
    setSelectedMethod(methodId);
    setStep(2);
  };

  const handlePayment = async () => {
    const amountToPay = Number(amountInput || amount);
    if (!Number.isFinite(amountToPay) || amountToPay <= 0) {
      setErrorText('Please enter a valid amount');
      return;
    }
    // Allow any positive amount - no limits for flexible service pricing
    if (selectedMethod === 'cash') {
      // For cash payments, just mark as completed
      setIsProcessing(true);
      setStep(3);
      
      try {
        // Create payment record for cash
        const paymentData = {
          requestId: requestId,
          amount: amountToPay,
          method: 'cash',
          transactionId: `CASH-${Date.now()}`,
          commissionRate: 0.1
        };
        
        await paymentsAPI.createPayment(paymentData);
        
        setTimeout(() => {
          setIsProcessing(false);
          setStep(4);
          toast.success('Payment completed! Cash payment confirmed.');
          onPaymentSuccess({
            method: 'cash',
            transactionId: paymentData.transactionId,
            amount: amountToPay
          });
        }, 2000);
      } catch (error) {
        setIsProcessing(false);
        setStep(2);
        toast.error('Failed to process cash payment. Please try again.');
        onPaymentError(error);
      }
      return;
    }

    // Validate inputs based on selected method
    if (selectedMethod !== 'cash' && !phoneNumber) {
      toast.error('Please enter your phone number');
      return;
    }

    if (selectedMethod === 'card') {
      if (!cardNumber || !expiryDate || !cvv || !cardholderName) {
        toast.error('Please fill in all card details');
        return;
      }
    }

    setIsProcessing(true);
    setStep(3);

    try {
      // Simulate payment processing
      setTimeout(async () => {
        // Simulate OTP verification for mobile wallets
        if (['bkash', 'nagad', 'rocket'].includes(selectedMethod)) {
          if (otp !== '1234') {
            setIsProcessing(false);
            setStep(2);
            toast.error('Invalid OTP. Please try again.');
            return;
          }
        }

        // Simulate PIN verification
        if (pin !== '1234') {
          setIsProcessing(false);
          setStep(2);
          toast.error('Invalid PIN. Please try again.');
          return;
        }

        // Process payment with backend
        const transactionId = `${selectedMethod.toUpperCase()}-${Date.now()}`;
        const paymentData = {
          requestId: requestId,
          amount: amountToPay,
          method: selectedMethod,
          transactionId: transactionId,
          commissionRate: 0.1
        };

        try {
          const created = await paymentsAPI.createPayment(paymentData);
          const createdPaymentId = created?.data?.payment?._id || requestId; // fallback

          setTimeout(() => {
            setIsProcessing(false);
            setStep(4);
            toast.success('Payment completed successfully!');
            
            onPaymentSuccess({
              method: selectedMethod,
              transactionId: transactionId,
              amount: amountToPay,
              phoneNumber: phoneNumber
            });
            // Stash created payment id on component for invoice button
            window.__lastPaymentId = createdPaymentId;
          }, 1500);
        } catch (error) {
          setIsProcessing(false);
          setStep(2);
          const msg = error?.response?.data?.message || 'Payment processing failed. Please try again.';
          setErrorText(msg);
          toast.error(msg);
          onPaymentError(error);
        }
      }, 2000);
    } catch (error) {
      setIsProcessing(false);
      setStep(2);
      const msg = error?.response?.data?.message || 'Payment failed. Please try again.';
      setErrorText(msg);
      toast.error(msg);
      onPaymentError(error);
    }
  };

  const handleClose = () => {
    if (isProcessing) return;
    setStep(1);
    setPhoneNumber('');
    setOtp('');
    setPin('');
    setCardNumber('');
    setExpiryDate('');
    setCvv('');
    setCardholderName('');
    onClose();
  };

  const formatCardNumber = (value) => {
    return value.replace(/\s/g, '').replace(/(.{4})/g, '$1 ').trim();
  };

  const formatExpiryDate = (value) => {
    return value.replace(/\D/g, '').replace(/(.{2})/, '$1/').substring(0, 5);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Complete Payment</h2>
              <p className="text-sm text-gray-600">Enter any amount you want to pay</p>
            </div>
            <button
              onClick={handleClose}
              disabled={isProcessing}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
            {/* Step 1: Method Selection */}
            {step === 1 && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-4"
              >
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Choose Payment Method</h3>
                <div className="grid grid-cols-1 gap-4">
                  {paymentMethods.map((method) => (
                    <motion.button
                      key={method.id}
                      onClick={() => handleMethodSelect(method.id)}
                      whileHover={{ scale: 1.02, y: -2 }}
                      whileTap={{ scale: 0.98 }}
                      className={`relative group p-5 rounded-xl border-2 transition-all duration-300 ${
                        selectedMethod === method.id
                          ? 'border-green-500 bg-green-50 shadow-lg'
                          : 'border-gray-200 hover:border-gray-300 hover:shadow-md'
                      }`}
                    >
                      {/* Selection indicator */}
                      {selectedMethod === method.id && (
                        <div className="absolute -top-2 -right-2 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                          <CheckCircle className="w-4 h-4 text-white" />
                        </div>
                      )}
                      
                      {/* Hover effect */}
                      <div className={`absolute inset-0 rounded-xl opacity-0 group-hover:opacity-10 transition-opacity duration-300`} 
                           style={{ backgroundColor: method.color }}></div>
                      
                      <div className="relative flex items-center space-x-4">
                        <div 
                          className="w-14 h-14 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-lg"
                          style={{ backgroundColor: method.color }}
                        >
                          {method.icon}
                        </div>
                        <div className="flex-1 text-left">
                          <div className="font-bold text-gray-900 text-lg">{method.logo}</div>
                          <div className="text-sm text-gray-600">{method.description}</div>
                          {method.id === 'cash' && (
                            <div className="text-xs text-orange-600 font-medium mt-1">No fees • Instant</div>
                          )}
                          {['bkash', 'nagad', 'rocket'].includes(method.id) && (
                            <div className="text-xs text-blue-600 font-medium mt-1">Mobile Wallet • Secure</div>
                          )}
                          {method.id === 'card' && (
                            <div className="text-xs text-green-600 font-medium mt-1">Credit/Debit • Verified</div>
                          )}
                        </div>
                        
                        {/* Popular badge for bKash */}
                        {method.id === 'bkash' && (
                          <div className="bg-pink-100 text-pink-700 text-xs font-bold px-2 py-1 rounded-full">
                            Popular
                          </div>
                        )}
                      </div>
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Step 2: Payment Details */}
            {step === 2 && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-4"
              >
                <div className="flex items-center space-x-3 mb-6">
                  <button
                    onClick={() => setStep(1)}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                  <div 
                    className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold"
                    style={{ backgroundColor: selectedPaymentMethod.color }}
                  >
                    {selectedPaymentMethod.icon}
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900">{selectedPaymentMethod.logo}</div>
                    <div className="text-sm text-gray-600">Payment Details</div>
                  </div>
                </div>

                {/* Amount input */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Amount (৳)</label>
                  <input
                    type="number"
                    value={amountInput}
                    onChange={(e) => setAmountInput(e.target.value)}
                    placeholder="Enter any amount"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                  {errorText && <div className="text-sm text-red-600 mt-1">{errorText}</div>}
                </div>

                {/* Mobile Wallet Payment */}
                {['bkash', 'nagad', 'rocket'].includes(selectedMethod) && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Phone Number
                      </label>
                      <input
                        type="tel"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        placeholder="01XXXXXXXXX"
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        OTP (Use: 1234)
                      </label>
                      <input
                        type="text"
                        value={otp}
                        onChange={(e) => setOtp(e.target.value)}
                        placeholder="Enter 4-digit OTP"
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        maxLength="4"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        PIN (Use: 1234)
                      </label>
                      <div className="relative">
                        <input
                          type={showPin ? 'text' : 'password'}
                          value={pin}
                          onChange={(e) => setPin(e.target.value)}
                          placeholder="Enter PIN"
                          className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                          maxLength="4"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPin(!showPin)}
                          className="absolute right-3 top-1/2 transform -translate-y-1/2"
                        >
                          {showPin ? <EyeOff className="w-5 h-5 text-gray-400" /> : <Eye className="w-5 h-5 text-gray-400" />}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Card Payment */}
                {selectedMethod === 'card' && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Card Number
                      </label>
                      <input
                        type="text"
                        value={cardNumber}
                        onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                        placeholder="1234 5678 9012 3456"
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        maxLength="19"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Cardholder Name
                      </label>
                      <input
                        type="text"
                        value={cardholderName}
                        onChange={(e) => setCardholderName(e.target.value)}
                        placeholder="John Doe"
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Expiry Date
                        </label>
                        <input
                          type="text"
                          value={expiryDate}
                          onChange={(e) => setExpiryDate(formatExpiryDate(e.target.value))}
                          placeholder="MM/YY"
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                          maxLength="5"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          CVV
                        </label>
                        <div className="relative">
                          <input
                            type={showCvv ? 'text' : 'password'}
                            value={cvv}
                            onChange={(e) => setCvv(e.target.value)}
                            placeholder="123"
                            className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                            maxLength="4"
                          />
                          <button
                            type="button"
                            onClick={() => setShowCvv(!showCvv)}
                            className="absolute right-3 top-1/2 transform -translate-y-1/2"
                          >
                            {showCvv ? <EyeOff className="w-5 h-5 text-gray-400" /> : <Eye className="w-5 h-5 text-gray-400" />}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Cash Payment */}
                {selectedMethod === 'cash' && (
                  <div className="text-center py-8">
                    <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Banknote className="w-8 h-8 text-orange-600" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Cash Payment</h3>
                    <p className="text-gray-600 mb-4">
                      Pay ৳{amount} directly to the mechanic when service is completed.
                    </p>
                    <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                      <p className="text-sm text-orange-800">
                        <strong>Note:</strong> Please have exact change ready for the mechanic.
                      </p>
                    </div>
                  </div>
                )}

                {/* Payment Button */}
                <div className="pt-4">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handlePayment}
                    disabled={isProcessing}
                    className="relative group w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 disabled:from-gray-400 disabled:to-gray-500 text-white font-bold py-4 px-6 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center space-x-3 overflow-hidden"
                  >
                    {/* Animated background effect */}
                    <div className="absolute inset-0 bg-gradient-to-r from-green-400 to-green-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                    
                    {/* Shimmer effect */}
                    <div className="absolute inset-0 -top-1 -left-1 bg-gradient-to-r from-transparent via-white to-transparent opacity-0 group-hover:opacity-20 group-hover:animate-pulse"></div>
                    
                    {/* Button content */}
                    <div className="relative flex items-center space-x-3">
                      {isProcessing ? (
                        <>
                          <Loader2 className="w-6 h-6 animate-spin" />
                          <span className="text-lg font-semibold">Processing Payment...</span>
                        </>
                      ) : (
                        <>
                          <div className="w-6 h-6 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
                            <CreditCard className="w-4 h-4" />
                          </div>
                          <span className="text-lg font-semibold">Pay ৳{amountInput || amount}</span>
                          <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                        </>
                      )}
                    </div>
                    
                    {/* Security badge */}
                    <div className="absolute -top-2 -right-2 bg-blue-500 text-white text-xs font-bold px-2 py-1 rounded-full shadow-md">
                      🔒 Secure
                    </div>
                  </motion.button>
                </div>
              </motion.div>
            )}

            {/* Step 3: Processing */}
            {step === 3 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-8"
              >
                <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Processing Payment</h3>
                <p className="text-gray-600">
                  Please wait while we process your {selectedPaymentMethod.logo} payment...
                </p>
              </motion.div>
            )}

            {/* Step 4: Success */}
            {step === 4 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-8"
              >
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-8 h-8 text-green-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Payment Successful!</h3>
                <p className="text-gray-600 mb-6">
                  Your payment of ৳{amount} has been processed successfully.
                </p>
                
                <div className="bg-gray-50 rounded-lg p-4 mb-6">
                  <div className="text-sm text-gray-600 space-y-1">
                    <div className="flex justify-between">
                      <span>Payment Method:</span>
                      <span className="font-medium">{selectedPaymentMethod.logo}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Amount:</span>
                      <span className="font-medium">৳{amount}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Status:</span>
                      <span className="font-medium text-green-600">Completed</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={async () => {
                      try {
                        // Prefer created payment id if available
                        const paymentIdForInvoice = window.__lastPaymentId || requestId;
                        const blob = await paymentsAPI.getPaymentInvoice(paymentIdForInvoice);
                        const url = window.URL.createObjectURL(blob);
                        const link = document.createElement('a');
                        link.href = url;
                        link.download = `invoice-${paymentIdForInvoice}.pdf`;
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                        window.URL.revokeObjectURL(url);
                        toast.success('Invoice downloaded successfully!');
                        handleClose();
                      } catch (error) {
                        toast.error('Failed to download invoice. Please try again.');
                      }
                    }}
                    className="relative group w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-bold py-4 px-6 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center space-x-3 overflow-hidden"
                  >
                    {/* Animated background effect */}
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-400 to-blue-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                    
                    {/* Button content */}
                    <div className="relative flex items-center space-x-3">
                      <div className="w-6 h-6 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
                        <Download className="w-4 h-4" />
                      </div>
                      <span className="text-lg font-semibold">Download Invoice</span>
                    </div>
                    
                    {/* PDF badge */}
                    <div className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full shadow-md">
                      PDF
                    </div>
                  </motion.button>
                  
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleClose}
                    className="w-full bg-gradient-to-r from-gray-500 to-gray-600 hover:from-gray-600 hover:to-gray-700 text-white font-semibold py-3 px-4 rounded-lg transition-all duration-300"
                  >
                    Close
                  </motion.button>
                </div>
              </motion.div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default PaymentModal;
