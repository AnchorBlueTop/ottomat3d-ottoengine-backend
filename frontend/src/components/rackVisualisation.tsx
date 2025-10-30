import React from 'react';
import { Shelf } from '../representations/ottorackRepresentation';
// import './rackVisualisation.css'; // <-- add this import

type ShelfType = '' | 'empty_plate';

type Props = {
  count: number;
  shelves: Array<Pick<Shelf, 'id' | 'type' | 'occupied'>>;
  onTypeChange: (shelfNumber: number, newType: ShelfType) => void;
  onShelfClick?: (shelfNumber: number) => void;
  className?: string;
};

export default function RackVisualizer({
  count,
  shelves,
  onTypeChange,
  onShelfClick,
  className
}: Props) {
  if (!count || count < 1) return null;

  return (
    <div className={`rack-visualizer ${className ?? ''}`}>
      {/* {Array.from({ length: count }, (_, i) => {
        const shelfNumber = count - i;
        const shelf = shelves?.find((s) => s.id === shelfNumber);
        const wrapperClass =
          shelf?.type === 'empty_plate' ? 'empty-plate-bg' : 'empty-shelf-bg';

        return (
          <div key={shelfNumber} className="shelf-row no-divider">
            <span className="shelf-number">{shelfNumber}</span>
            <label className={`customCheckBoxWrapper ${wrapperClass}`}>
              <div
                className="customCheckBox"
                onClick={onShelfClick ? () => onShelfClick(shelfNumber) : undefined}
              >
                <select
                  className="shelf-dropdown"
                  value={(shelf?.type as ShelfType) || ''}
                  onChange={(e) =>
                    onTypeChange(shelfNumber, e.target.value as ShelfType)
                  }
                  onClick={(e) => e.stopPropagation()}
                >
                  <option value="">Empty Shelf</option>
                  <option value="empty_plate">Empty Plate</option>
                </select>
              </div>
            </label>
          </div>
        );
      })} */}
      {/* {Array.from({ length: count }, (_, i) => {
        const shelfNumber = count - i;
        const shelf = shelves.find(s => s.id === shelfNumber);
        const isEmptyPlate = shelf?.type === 'empty_plate';
        const wrapperClass = isEmptyPlate ? 'empty-plate-bg' : 'empty-shelf-bg';

        return (
          <div key={shelfNumber} className="shelf-row no-divider">
            <span className="shelf-number">{shelfNumber}</span>
            <label className={`customCheckBoxWrapper ${wrapperClass}`}>
              <div
                className="customCheckBox"
                onClick={onShelfClick ? () => onShelfClick(shelfNumber) : undefined}
              >
                <select
                  className={`shelf-dropdown ${wrapperClass}`}
                  value={shelf?.type || ''}
                  onChange={(e) => onTypeChange(shelfNumber, e.target.value as '' | 'empty_plate')}
                  onClick={(e) => e.stopPropagation()}
                >
                  <option value="">Empty shelf</option>
                  <option value="empty_plate">Empty plate</option>
                </select>
              </div>
            </label>
          </div>
        );
      })} */}

      {/* {Array.from({ length: count }, (_, i) => {
        const shelfNumber = count - i;
        const shelf = shelves.find(s => s.id === shelfNumber);
        const isEmptyPlate = shelf?.type === 'empty_plate';
        const wrapperClass = isEmptyPlate ? 'empty-plate-bg' : 'empty-shelf-bg';

        return (
          <div key={shelfNumber} className={`shelf-row no-divider ${wrapperClass}`}>
            <span className="shelf-number">{shelfNumber}</span>
            <label className={`customCheckBoxWrapper ${wrapperClass}`}>
              <div
                className="customCheckBox"
                onClick={onShelfClick ? () => onShelfClick(shelfNumber) : undefined}
              >
                <select
                  className="shelf-dropdown"
                  value={shelf?.type || ''}
                  onChange={(e) => onTypeChange(shelfNumber, e.target.value as '' | 'empty_plate')}
                  onClick={(e) => e.stopPropagation()}
                >
                  <option value="">Empty shelf</option>
                  <option value="empty_plate">Empty plate</option>
                </select>
              </div>
            </label>
          </div>
        );
      })} */}

      {Array.from({ length: count }, (_, i) => {
        const shelfNumber = count - i;
        const shelf = shelves.find(s => s.id === shelfNumber);
        const isEmptyPlate = shelf?.type === 'empty_plate';
        const wrapperClass = isEmptyPlate ? 'empty-plate-bg' : 'empty-shelf-bg';

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
                  value={shelf?.type || ''}
                  onChange={(e) => onTypeChange(shelfNumber, e.target.value as '' | 'empty_plate')}
                  onClick={(e) => e.stopPropagation()}
                >
                  <option value="">Empty shelf</option>
                  <option value="empty_plate">Empty plate</option>
                </select>
              </div>
            </label>
          </div>
        );
      })}

    </div>
  );
}