import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import { ToastContainer } from './components/ui/Toast';
import { ProtectedRoute } from './components/ProtectedRoute';
import { MainLayout } from './components/layout/MainLayout';
import { Login } from './pages/Login';
import { Signup } from './pages/Signup';
import { Dashboard } from './pages/Dashboard';
import { Items } from './pages/Items';
import { Customers } from './pages/Customers';
import { Vendors } from './pages/Vendors';
import { Invoices } from './pages/Invoices';
import { InvoiceForm } from './pages/InvoiceForm';
import { InvoiceFormNew } from './pages/InvoiceFormNew';
import { ViewInvoice } from './pages/ViewInvoice';
import { Quotations } from './pages/Quotations';
import { QuotationForm } from './pages/QuotationForm';
import { ViewQuotation } from './pages/ViewQuotation';
import { SalesOrders } from './pages/SalesOrders';
import { SalesOrderForm } from './pages/SalesOrderForm';
import { ViewSalesOrder } from './pages/ViewSalesOrder';
import { DeliveryOrders } from './pages/DeliveryOrders';
import { DeliveryOrderForm } from './pages/DeliveryOrderForm';
import { ViewDeliveryOrder } from './pages/ViewDeliveryOrder';
import { PurchaseOrders } from './pages/PurchaseOrders';
import { PurchaseOrderForm } from './pages/PurchaseOrderForm';
import { ViewPurchaseOrder } from './pages/ViewPurchaseOrder';
import { TermsConditions } from './pages/TermsConditions';

function App() {
    return (
        <AuthProvider>
            <ToastProvider>
                <BrowserRouter>
                    <ToastContainer />
                    <Routes>
                        {/* Public Routes */}
                        <Route path="/login" element={<Login />} />
                        <Route path="/signup" element={<Signup />} />

                        {/* Protected Routes */}
                        <Route
                            path="/"
                            element={
                                <ProtectedRoute>
                                    <MainLayout>
                                        <Dashboard />
                                    </MainLayout>
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/items"
                            element={
                                <ProtectedRoute>
                                    <MainLayout>
                                        <Items />
                                    </MainLayout>
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/customers"
                            element={
                                <ProtectedRoute>
                                    <MainLayout>
                                        <Customers />
                                    </MainLayout>
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/vendors"
                            element={
                                <ProtectedRoute>
                                    <MainLayout>
                                        <Vendors />
                                    </MainLayout>
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/invoices"
                            element={
                                <ProtectedRoute>
                                    <MainLayout>
                                        <Invoices />
                                    </MainLayout>
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/invoices/new"
                            element={
                                <ProtectedRoute>
                                    <MainLayout>
                                        <InvoiceFormNew />
                                    </MainLayout>
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/invoices/edit/:id"
                            element={
                                <ProtectedRoute>
                                    <MainLayout>
                                        <InvoiceForm />
                                    </MainLayout>
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/invoices/:id"
                            element={
                                <ProtectedRoute>
                                    <MainLayout>
                                        <ViewInvoice />
                                    </MainLayout>
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/quotations"
                            element={
                                <ProtectedRoute>
                                    <MainLayout>
                                        <Quotations />
                                    </MainLayout>
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/quotations/new"
                            element={
                                <ProtectedRoute>
                                    <MainLayout>
                                        <QuotationForm />
                                    </MainLayout>
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/quotations/edit/:id"
                            element={
                                <ProtectedRoute>
                                    <MainLayout>
                                        <QuotationForm />
                                    </MainLayout>
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/quotations/:id"
                            element={
                                <ProtectedRoute>
                                    <MainLayout>
                                        <ViewQuotation />
                                    </MainLayout>
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/sales-orders"
                            element={
                                <ProtectedRoute>
                                    <MainLayout>
                                        <SalesOrders />
                                    </MainLayout>
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/sales-orders/new"
                            element={
                                <ProtectedRoute>
                                    <MainLayout>
                                        <SalesOrderForm />
                                    </MainLayout>
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/sales-orders/edit/:id"
                            element={
                                <ProtectedRoute>
                                    <MainLayout>
                                        <SalesOrderForm />
                                    </MainLayout>
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/sales-orders/:id"
                            element={
                                <ProtectedRoute>
                                    <MainLayout>
                                        <ViewSalesOrder />
                                    </MainLayout>
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/delivery-orders"
                            element={
                                <ProtectedRoute>
                                    <MainLayout>
                                        <DeliveryOrders />
                                    </MainLayout>
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/delivery-orders/new"
                            element={
                                <ProtectedRoute>
                                    <MainLayout>
                                        <DeliveryOrderForm />
                                    </MainLayout>
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/delivery-orders/edit/:id"
                            element={
                                <ProtectedRoute>
                                    <MainLayout>
                                        <DeliveryOrderForm />
                                    </MainLayout>
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/delivery-orders/:id"
                            element={
                                <ProtectedRoute>
                                    <MainLayout>
                                        <ViewDeliveryOrder />
                                    </MainLayout>
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/purchase-orders"
                            element={
                                <ProtectedRoute>
                                    <MainLayout>
                                        <PurchaseOrders />
                                    </MainLayout>
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/purchase-orders/new"
                            element={
                                <ProtectedRoute>
                                    <MainLayout>
                                        <PurchaseOrderForm />
                                    </MainLayout>
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/purchase-orders/edit/:id"
                            element={
                                <ProtectedRoute>
                                    <MainLayout>
                                        <PurchaseOrderForm />
                                    </MainLayout>
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/purchase-orders/:id"
                            element={
                                <ProtectedRoute>
                                    <MainLayout>
                                        <ViewPurchaseOrder />
                                    </MainLayout>
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/terms"
                            element={
                                <ProtectedRoute>
                                    <MainLayout>
                                        <TermsConditions />
                                    </MainLayout>
                                </ProtectedRoute>
                            }
                        />

                        {/* Catch all */}
                        <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>
                </BrowserRouter>
            </ToastProvider>
        </AuthProvider>
    );
}

export default App;
