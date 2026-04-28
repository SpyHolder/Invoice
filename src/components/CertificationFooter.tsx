import { forwardRef } from 'react';

interface CertificationFooterProps {
    currentPage?: number;
    totalPages?: number;
    mode?: 'inline' | 'print-fixed';
}

/**
 * Certification footer with two modes:
 * - "inline": Original flow-based footer (for screen preview, pushed to bottom via marginTop:auto)
 * - "print-fixed": CSS position:fixed footer that appears on EVERY printed page
 */
export const CertificationFooter = forwardRef<HTMLDivElement, CertificationFooterProps>(
    ({ currentPage, totalPages, mode = 'inline' }, ref) => {

        // Print-fixed mode: renders a fixed-position footer visible only in print
        if (mode === 'print-fixed') {
            return (
                <>
                    <style>{`
                        @media print {
                            .cert-footer-print-fixed {
                                position: fixed;
                                bottom: 0;
                                left: 0;
                                right: 0;
                                padding: 0 32px 8px 32px;
                                z-index: 9999;
                                background: white;
                            }
                            .cert-footer-print-fixed hr {
                                border: none;
                                border-top: 1px solid #d0d0d0;
                                margin: 0 0 6px 0;
                            }
                            .cert-footer-inline {
                                display: none !important;
                            }
                            /* Remove minHeight to prevent blank overflow pages */
                            .print-page {
                                min-height: auto !important;
                            }
                            /* Reserve space at bottom for fixed footer */
                            @page {
                                margin: 0;
                            }
                        }
                        @media screen {
                            .cert-footer-print-fixed {
                                display: none !important;
                            }
                        }
                    `}</style>
                    <div className="cert-footer-print-fixed">
                        <hr />
                        <div style={{
                            display: 'flex',
                            justifyContent: 'flex-end',
                            alignItems: 'center',
                            gap: '16px',
                            marginBottom: '4px',
                        }}>
                            <img src="/images/iso-45001.png" alt="ISO 45001:2018" style={{ height: '50px', objectFit: 'contain' }} />
                            <img src="/images/sac-certification.png" alt="SAC Accredited Certification Body" style={{ height: '50px', objectFit: 'contain' }} />
                            <img src="/images/bizsafe-star.png" alt="bizSAFE STAR" style={{ height: '50px', objectFit: 'contain' }} />
                        </div>
                    </div>
                </>
            );
        }

        // Inline mode: original behavior (for screen preview)
        return (
            <div ref={ref} className="cert-footer-inline" style={{ marginTop: 'auto', paddingTop: '20px' }}>
                {/* Thin horizontal divider line */}
                <hr style={{
                    border: 'none',
                    borderTop: '1px solid #d0d0d0',
                    margin: '0 0 16px 0',
                }} />

                {/* Logos row - RIGHT aligned, large size */}
                <div style={{
                    display: 'flex',
                    justifyContent: 'flex-end',
                    alignItems: 'center',
                    gap: '16px',
                    marginBottom: '8px',
                }}>
                    <img
                        src="/images/iso-45001.png"
                        alt="ISO 45001:2018"
                        style={{ height: '60px', objectFit: 'contain' }}
                    />
                    <img
                        src="/images/sac-certification.png"
                        alt="SAC Accredited Certification Body"
                        style={{ height: '60px', objectFit: 'contain' }}
                    />
                    <img
                        src="/images/bizsafe-star.png"
                        alt="bizSAFE STAR"
                        style={{ height: '60px', objectFit: 'contain' }}
                    />
                </div>

                {/* Page number - right aligned below logos */}
                {currentPage != null && totalPages != null && (
                    <div style={{
                        textAlign: 'right',
                        fontSize: '11px',
                        color: '#111827',
                        fontFamily: 'sans-serif',
                    }}>
                        Page <span style={{ fontWeight: 'bold' }}>{currentPage}</span> of {totalPages}
                    </div>
                )}
            </div>
        );
    }
);

CertificationFooter.displayName = 'CertificationFooter';
