"use client";
import { useEffect, useState, useCallback } from "react";
import { ShieldCheck, Package, ScanLine, CheckCircle, XCircle, AlertTriangle, Volume2, FileText } from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import BarcodeScanner from "@/components/ui/BarcodeScanner";
import Textarea from "@/components/ui/Textarea";
import { logScanEvent, resolveBarcode } from "@/lib/api/scan-events";
import { getWarehouseTask, getInspectionCriteria, submitInspectionResult, WarehouseTaskWithRelations } from "@/lib/api/warehouse-tasks";
import { InspectionCriterion, InspectionOverallResult } from "@/types/database";

interface InspectionScannerProps {
  taskId: string;
  onComplete?: () => void;
}

export default function InspectionScanner({ taskId, onComplete }: InspectionScannerProps) {
  const [task, setTask] = useState<WarehouseTaskWithRelations | null>(null);
  const [criteria, setCriteria] = useState<InspectionCriterion[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [scannerActive, setScannerActive] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [productConfirmed, setProductConfirmed] = useState(false);

  const [checklistResults, setChecklistResults] = useState<Record<string, 'pass' | 'fail'>>({});
  const [checklistNotes, setChecklistNotes] = useState<Record<string, string>>({});
  const [inspectorNotes, setInspectorNotes] = useState("");

  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Audio feedback
  const playBeep = useCallback((success: boolean = true) => {
    if (!audioEnabled) return;

    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = success ? 800 : 400;
    oscillator.type = 'sine';

    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.1);
  }, [audioEnabled]);

  // Load task and criteria
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const taskData = await getWarehouseTask(taskId);

        if (!taskData) {
          setMessage({ type: 'error', text: 'Task not found' });
          setLoading(false);
          return;
        }

        setTask(taskData);

        if (taskData.client_id) {
          const criteriaData = await getInspectionCriteria(taskData.client_id);
          setCriteria(criteriaData);
        }
      } catch (error) {
        console.error('Failed to load inspection data:', error);
        setMessage({ type: 'error', text: 'Failed to load inspection data' });
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [taskId]);

  // Handle barcode scan
  const handleScan = useCallback(async (barcode: string) => {
    if (!task) return;

    try {
      // Log scan event
      await logScanEvent({
        scanType: 'product',
        barcode,
        workflowStage: 'inspection',
        referenceType: 'warehouse_task',
        referenceId: taskId,
        productId: task.product_id || undefined,
      });

      // Resolve barcode
      const resolved = await resolveBarcode(barcode);

      if (!resolved) {
        setMessage({ type: 'error', text: 'Barcode not recognized' });
        playBeep(false);
        return;
      }

      // Check if it matches the expected product
      if (resolved.type === 'product' && resolved.id === task.product_id) {
        setProductConfirmed(true);
        setScannerActive(false);
        playBeep(true);
        setMessage({ type: 'success', text: `Product confirmed` });
      } else {
        setMessage({ type: 'error', text: 'Product does not match expected item' });
        playBeep(false);
      }
    } catch (error) {
      console.error('Scan error:', error);
      setMessage({ type: 'error', text: 'Failed to process scan' });
      playBeep(false);
    }
  }, [task, taskId, playBeep]);

  // Toggle checklist item result
  const toggleResult = (criterionId: string, result: 'pass' | 'fail') => {
    setChecklistResults(prev => ({
      ...prev,
      [criterionId]: prev[criterionId] === result ? undefined as any : result
    }));
  };

  // Update checklist note
  const updateNote = (criterionId: string, note: string) => {
    setChecklistNotes(prev => ({
      ...prev,
      [criterionId]: note
    }));
  };

  // Calculate overall result
  const calculateOverallResult = (): InspectionOverallResult => {
    const results = Object.values(checklistResults);
    if (results.length === 0) return 'partial';

    const allPass = results.every(r => r === 'pass');
    const allFail = results.every(r => r === 'fail');

    if (allPass) return 'pass';
    if (allFail) return 'fail';
    return 'partial';
  };

  // Check if all required criteria are checked
  const allRequiredChecked = criteria
    .filter(c => c.required)
    .every(c => checklistResults[c.id] !== undefined);

  // Submit inspection
  const handleSubmit = async () => {
    if (!task) return;

    try {
      setSubmitting(true);
      setMessage(null);

      const overallResult = calculateOverallResult();

      // Transform checklistResults to the proper array format
      const resultItems = criteria.map(c => ({
        item_id: c.id,
        label: c.label,
        result: checklistResults[c.id] || 'pass' as 'pass' | 'fail',
        notes: checklistNotes[c.id] || undefined,
      }));

      await submitInspectionResult(taskId, {
        results: resultItems,
        notes: inspectorNotes,
        overallResult,
      });

      playBeep(true);
      setMessage({ type: 'success', text: 'Inspection submitted successfully' });

      // Call onComplete after a brief delay
      setTimeout(() => {
        onComplete?.();
      }, 1500);
    } catch (error) {
      console.error('Failed to submit inspection:', error);
      setMessage({ type: 'error', text: 'Failed to submit inspection' });
      playBeep(false);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!task) {
    return (
      <Card className="p-6">
        <p className="text-slate-600">Task not found</p>
      </Card>
    );
  }

  const product = task.product;
  const overallResult = calculateOverallResult();

  return (
    <div className="space-y-6">
      {/* Audio Toggle */}
      <div className="flex justify-end">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setAudioEnabled(!audioEnabled)}
          className="gap-2"
        >
          <Volume2 className={`h-4 w-4 ${audioEnabled ? 'text-indigo-600' : 'text-slate-400'}`} />
          {audioEnabled ? 'Audio On' : 'Audio Off'}
        </Button>
      </div>

      {/* Product Info */}
      <Card className="p-6 border-slate-200/80">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-indigo-50 rounded-lg">
            <Package className="h-6 w-6 text-indigo-600" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-slate-900">{product?.name || 'Unknown Product'}</h3>
            <div className="mt-2 space-y-1 text-sm text-slate-600">
              <p><span className="font-medium">SKU:</span> {product?.sku || 'N/A'}</p>
              <p><span className="font-medium">Quantity:</span> {task.qty_requested || 0} units</p>
              {task.source_location?.name && (
                <p><span className="font-medium">Location:</span> {task.source_location.name}</p>
              )}
            </div>
          </div>
          {productConfirmed && (
            <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 px-3 py-1.5 rounded-lg">
              <CheckCircle className="h-4 w-4" />
              Verified
            </div>
          )}
        </div>
      </Card>

      {/* Scan to Verify (Optional) */}
      {!productConfirmed && (
        <Card className="p-6 border-slate-200/80">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <ScanLine className="h-5 w-5 text-indigo-600" />
              <h3 className="font-semibold text-slate-900">Scan to Verify (Optional)</h3>
            </div>
            <Button
              variant={scannerActive ? "secondary" : "primary"}
              size="sm"
              onClick={() => setScannerActive(!scannerActive)}
            >
              {scannerActive ? 'Cancel' : 'Start Scanner'}
            </Button>
          </div>

          {scannerActive && (
            <div className="mt-4">
              <BarcodeScanner
                onScan={handleScan}
                isActive={scannerActive}
              />
            </div>
          )}
        </Card>
      )}

      {/* Inspection Checklist */}
      <Card className="p-6 border-slate-200/80">
        <div className="flex items-center gap-2 mb-4">
          <ShieldCheck className="h-5 w-5 text-indigo-600" />
          <h3 className="font-semibold text-slate-900">Inspection Checklist</h3>
        </div>

        {criteria.length === 0 ? (
          <p className="text-sm text-slate-500">No inspection criteria defined for this client</p>
        ) : (
          <div className="space-y-4">
            {criteria.map((criterion) => {
              const result = checklistResults[criterion.id];
              const note = checklistNotes[criterion.id] || '';

              return (
                <div key={criterion.id} className="border border-slate-200 rounded-lg p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-slate-900">{criterion.label}</p>
                        {criterion.required && (
                          <span className="text-xs text-red-600 font-medium">Required</span>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        variant={result === 'pass' ? 'primary' : 'secondary'}
                        size="sm"
                        onClick={() => toggleResult(criterion.id, 'pass')}
                        className={result === 'pass' ? 'bg-green-600 hover:bg-green-700' : ''}
                      >
                        <CheckCircle className="h-4 w-4" />
                      </Button>
                      <Button
                        variant={result === 'fail' ? 'primary' : 'secondary'}
                        size="sm"
                        onClick={() => toggleResult(criterion.id, 'fail')}
                        className={result === 'fail' ? 'bg-red-600 hover:bg-red-700' : ''}
                      >
                        <XCircle className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {result && (
                    <div className="mt-3">
                      <Textarea
                        value={note}
                        onChange={(e) => updateNote(criterion.id, e.target.value)}
                        placeholder="Add notes (optional)"
                        rows={2}
                        className="text-sm"
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Inspector Notes */}
      <Card className="p-6 border-slate-200/80">
        <div className="flex items-center gap-2 mb-4">
          <FileText className="h-5 w-5 text-indigo-600" />
          <h3 className="font-semibold text-slate-900">Inspector Notes</h3>
        </div>
        <Textarea
          value={inspectorNotes}
          onChange={(e) => setInspectorNotes(e.target.value)}
          placeholder="Add overall inspection notes..."
          rows={4}
        />
      </Card>

      {/* Overall Result Summary */}
      {Object.keys(checklistResults).length > 0 && (
        <Card className={`p-4 border-2 ${
          overallResult === 'pass' ? 'border-green-200 bg-green-50' :
          overallResult === 'fail' ? 'border-red-200 bg-red-50' :
          'border-yellow-200 bg-yellow-50'
        }`}>
          <div className="flex items-center gap-3">
            {overallResult === 'pass' ? (
              <CheckCircle className="h-6 w-6 text-green-600" />
            ) : overallResult === 'fail' ? (
              <XCircle className="h-6 w-6 text-red-600" />
            ) : (
              <AlertTriangle className="h-6 w-6 text-yellow-600" />
            )}
            <div>
              <p className="font-semibold text-slate-900">
                Overall Result: {overallResult.charAt(0).toUpperCase() + overallResult.slice(1)}
              </p>
              <p className="text-sm text-slate-600">
                {Object.values(checklistResults).filter(r => r === 'pass').length} passed,
                {Object.values(checklistResults).filter(r => r === 'fail').length} failed
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Message Display */}
      {message && (
        <div className={`p-4 rounded-lg ${
          message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
        }`}>
          <p className="text-sm font-medium">{message.text}</p>
        </div>
      )}

      {/* Submit Button */}
      <div className="flex justify-end gap-3">
        <Button
          variant="primary"
          onClick={handleSubmit}
          disabled={!allRequiredChecked || submitting || Object.keys(checklistResults).length === 0}
          className="min-w-[200px]"
        >
          {submitting ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              Submitting...
            </>
          ) : (
            <>
              <CheckCircle className="h-4 w-4 mr-2" />
              Submit Inspection
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
