import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLocation } from '../context/LocationContext';
import { 
  MapPin, 
  Wrench, 
  Clock, 
  Shield, 
  Star, 
  Phone,
  Car,
  Bike,
  Truck,
  ArrowRight,
  CheckCircle
} from 'lucide-react';
import { motion } from 'framer-motion';
import LoadingSpinner from '../components/LoadingSpinner';

const LandingPage = () => {
  const { isAuthenticated, user } = useAuth();
  const { getCurrentLocation, currentLocation, isLoading: locationLoading } = useLocation();
  const navigate = useNavigate();
  const [stats] = useState({
    totalMechanics: 500,
    totalRequests: 2500,
    avgResponseTime: 15,
    customerSatisfaction: 4.8
  });

  useEffect(() => {
    // Redirect authenticated users to their dashboard
    if (isAuthenticated) {
      switch (user?.role) {
        case 'admin':
          navigate('/admin/dashboard');
          break;
        case 'mechanic':
          navigate('/mechanic/dashboard');
          break;
        default:
          navigate('/dashboard');
      }
    }
  }, [isAuthenticated, user, navigate]);

  const handleGetStarted = async () => {
    if (!currentLocation) {
      await getCurrentLocation();
    }
    navigate('/register');
  };

  const handleFindMechanics = async () => {
    if (!currentLocation) {
      await getCurrentLocation();
    }
    navigate('/find-mechanics');
  };

  const services = [
    {
      icon: Car,
      title: 'Car Repair',
      description: 'Engine problems, brake issues, electrical faults, and more',
      color: 'bg-blue-500'
    },
    {
      icon: Bike,
      title: 'Bike Service',
      description: 'Motorcycle and bicycle repairs, tire changes, engine tune-ups',
      color: 'bg-green-500'
    },
    {
      icon: Truck,
      title: 'Truck Assistance',
      description: 'Heavy vehicle repairs, towing services, emergency support',
      color: 'bg-orange-500'
    }
  ];

  const features = [
    {
      icon: MapPin,
      title: 'GPS Location Tracking',
      description: 'Real-time location sharing and mechanic tracking for your safety'
    },
    {
      icon: Clock,
      title: '24/7 Availability',
      description: 'Round-the-clock emergency assistance whenever you need help'
    },
    {
      icon: Shield,
      title: 'Verified Mechanics',
      description: 'All mechanics are background-checked and certified professionals'
    },
    {
      icon: Star,
      title: 'Quality Guaranteed',
      description: 'Rated services with customer reviews and satisfaction guarantee'
    }
  ];

  const testimonials = [
    {
      name: 'Ahmed Rahman',
      location: 'Dhaka',
      rating: 5,
      comment: 'Amazing service! Got help within 10 minutes when my car broke down on the highway.'
    },
    {
      name: 'Fatima Khan',
      location: 'Chittagong',
      rating: 5,
      comment: 'Professional mechanics and fair pricing. Highly recommend RoadAssist BD!'
    },
    {
      name: 'Mohammad Ali',
      location: 'Sylhet',
      rating: 5,
      comment: 'Saved my day when I had a flat tire. Quick response and excellent service.'
    }
  ];

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-primary-600 via-primary-700 to-primary-800 text-white overflow-hidden">
        <div className="absolute inset-0 bg-black/20"></div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-32">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
            >
              <h1 className="text-4xl lg:text-6xl font-bold leading-tight mb-6">
                Roadside Help
                <span className="block text-yellow-400">When You Need It</span>
              </h1>
              <p className="text-xl lg:text-2xl text-blue-100 mb-8 leading-relaxed">
                Get instant assistance for your vehicle anywhere in Bangladesh. 
                Connect with verified mechanics in minutes, not hours.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 mb-8">
                <button
                  onClick={handleGetStarted}
                  disabled={locationLoading}
                  className="btn btn-secondary btn-lg flex items-center justify-center space-x-2 shadow-lg hover:shadow-xl transition-shadow"
                >
                  {locationLoading ? (
                    <LoadingSpinner size="sm" color="white" />
                  ) : (
                    <>
                      <MapPin className="w-5 h-5" />
                      <span>Get Started</span>
                    </>
                  )}
                </button>
                
                <Link
                  to="/register?role=mechanic"
                  className="btn btn-outline btn-lg border-white text-white hover:bg-white hover:text-primary-600"
                >
                  Join as Mechanic
                </Link>
              </div>

              <div className="flex items-center space-x-6 text-blue-100">
                <div className="flex items-center space-x-2">
                  <CheckCircle className="w-5 h-5 text-green-400" />
                  <span>24/7 Available</span>
                </div>
                <div className="flex items-center space-x-2">
                  <CheckCircle className="w-5 h-5 text-green-400" />
                  <span>Verified Mechanics</span>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="relative"
            >
              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 border border-white/20">
                <h3 className="text-2xl font-bold mb-6">Quick Emergency Help</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-white/10 rounded-lg">
                    <span>Average Response Time</span>
                    <span className="font-bold text-yellow-400">{stats.avgResponseTime} min</span>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-white/10 rounded-lg">
                    <span>Available Mechanics</span>
                    <span className="font-bold text-green-400">{stats.totalMechanics}+</span>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-white/10 rounded-lg">
                    <span>Customer Rating</span>
                    <div className="flex items-center space-x-1">
                      <Star className="w-4 h-4 text-yellow-400 fill-current" />
                      <span className="font-bold">{stats.customerSatisfaction}</span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
              Services We Provide
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              From emergency breakdowns to routine maintenance, we've got you covered
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {services.map((service, index) => {
              const Icon = service.icon;
              return (
                <motion.div
                  key={service.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: index * 0.1 }}
                  className="bg-white rounded-xl p-8 shadow-soft hover:shadow-medium transition-shadow"
                >
                  <div className={`w-16 h-16 ${service.color} rounded-lg flex items-center justify-center mb-6`}>
                    <Icon className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-4">{service.title}</h3>
                  <p className="text-gray-600">{service.description}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
              Why Choose RoadAssist BD?
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              We're committed to providing the best roadside assistance experience in Bangladesh
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: index * 0.1 }}
                  className="text-center"
                >
                  <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Icon className="w-8 h-8 text-primary-600" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-4">{feature.title}</h3>
                  <p className="text-gray-600">{feature.description}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-20 bg-primary-600 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 text-center">
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6 }}
            >
              <div className="text-4xl lg:text-5xl font-bold mb-2">{stats.totalMechanics}+</div>
              <div className="text-primary-100">Verified Mechanics</div>
            </motion.div>
            
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.1 }}
            >
              <div className="text-4xl lg:text-5xl font-bold mb-2">{stats.totalRequests}+</div>
              <div className="text-primary-100">Requests Completed</div>
            </motion.div>
            
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              <div className="text-4xl lg:text-5xl font-bold mb-2">{stats.avgResponseTime}</div>
              <div className="text-primary-100">Avg Response (min)</div>
            </motion.div>
            
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.3 }}
            >
              <div className="text-4xl lg:text-5xl font-bold mb-2">{stats.customerSatisfaction}</div>
              <div className="text-primary-100">Customer Rating</div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
              What Our Customers Say
            </h2>
            <p className="text-xl text-gray-600">
              Real experiences from real customers across Bangladesh
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <motion.div
                key={testimonial.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                className="bg-white rounded-xl p-6 shadow-soft"
              >
                <div className="flex items-center mb-4">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star key={i} className="w-5 h-5 text-yellow-400 fill-current" />
                  ))}
                </div>
                <p className="text-gray-600 mb-4">"{testimonial.comment}"</p>
                <div>
                  <div className="font-bold text-gray-900">{testimonial.name}</div>
                  <div className="text-sm text-gray-500">{testimonial.location}</div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gray-900 text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl lg:text-4xl font-bold mb-6">
            Ready to Get Help on the Road?
          </h2>
          <p className="text-xl text-gray-300 mb-8">
            Join thousands of satisfied customers who trust RoadAssist BD for their vehicle emergencies
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={handleFindMechanics}
              disabled={locationLoading}
              className="btn btn-primary btn-lg flex items-center justify-center space-x-2"
            >
              {locationLoading ? (
                <LoadingSpinner size="sm" color="white" />
              ) : (
                <>
                  <Wrench className="w-5 h-5" />
                  <span>Find Mechanics Now</span>
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
            
            <Link
              to="/register"
              className="btn btn-outline btn-lg border-white text-white hover:bg-white hover:text-gray-900"
            >
              Create Account
            </Link>
          </div>
          
          <div className="mt-8 flex items-center justify-center space-x-2 text-gray-300">
            <Phone className="w-4 h-4" />
            <span>Emergency Hotline: 16263</span>
          </div>
        </div>
      </section>
    </div>
  );
};

export default LandingPage;
