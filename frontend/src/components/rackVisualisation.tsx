// Removed unused React import
import { Shelf } from '../representations/ottorackRepresentation';
// import './rackVisualisation.css'; // <-- add this import

// Extend shelf type options to include build_plate
type ShelfType = '' | 'empty_plate' | 'build_plate';

type Props = {
  count: number;
  shelves: Array<Pick<Shelf, 'id' | 'type' | 'occupied'>>;
  onTypeChange: (shelfNumber: number, newType: ShelfType) => void;
  onShelfClick?: (shelfNumber: number) => void;
  className?: string;
  includeBuildPlateOption?: boolean;
};

export default function RackVisualizer({
  count,
  shelves,
  onTypeChange,
  onShelfClick,
  className,
  includeBuildPlateOption = true
}: Props) {
  if (!count || count < 1) return null;

  return (
    <div className={`rack-visualizer ${className ?? ''}`}>
      {Array.from({ length: count }, (_, i) => {
        const shelfNumber = count - i;
        const shelf = shelves.find(s => s.id === shelfNumber);
        const isEmptyPlate = shelf?.type === 'empty_plate';
        const isBuildPlate = shelf?.type === 'build_plate';
        const wrapperClass = isBuildPlate
          ? 'build-plate-bg'
          : isEmptyPlate
          ? 'empty-plate-bg'
          : 'empty-shelf-bg';

        return (
          <div key={shelfNumber} className={`shelf-row no-divider ${wrapperClass}`}>
            <span className="shelf-number">{shelfNumber}</span>
            <label className="customCheckBoxWrapper">
              <div
                className="customCheckBox"
                onClick={onShelfClick ? () => onShelfClick(shelfNumber) : undefined}
              >
                <select
                  className="shelf-dropdown"
                  value={(shelf?.type as ShelfType) || ''}
                  onChange={(e) => onTypeChange(shelfNumber, e.target.value as ShelfType)}
                  onClick={(e) => e.stopPropagation()}
                >
                  <option value="">Empty shelf</option>
                  <option value="empty_plate">Empty plate</option>
                  {includeBuildPlateOption && <option value="build_plate">Build plate</option>}
                </select>
              </div>
            </label>
          </div>
        );
      })}

    </div>
  );
}