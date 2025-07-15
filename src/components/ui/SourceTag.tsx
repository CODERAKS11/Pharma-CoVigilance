import type { SourceType } from '../../api/types';
import { Badge } from './Badge';

interface SourceTagProps {
  source: SourceType;
  size?: 'sm' | 'md';
}

export function SourceTag({ source, size = 'sm' }: SourceTagProps) {
  return <Badge variant="source" source={source} size={size} />;
}
