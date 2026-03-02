-- Add missing DELETE policy for supply_usage table
CREATE POLICY "Authenticated users can delete supply_usage"
  ON supply_usage FOR DELETE
  TO authenticated
  USING (true);
