import { PrintJob, Shelf, Rack, OttoRacks } from '../representations/ottorackRepresentation';

export class OttoRackClass {
  private storage: OttoRacks;

  constructor(initialStorage: OttoRacks = { racks: [] }) {
    this.storage = initialStorage;
  }

  public getStorage(): OttoRacks {
    return JSON.parse(JSON.stringify(this.storage));
  }

  // --- Rack Operations ---

  /**
   * Adds a new rack to the storage.
   * @param name The name of the rack.
   * @param location The physical location of the rack.
   * @returns The newly added rack, or undefined if a rack with the same ID already exists.
   */
  public addRack(name: string): Rack {
    const newRack: Rack = {
      id: `rack-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name,
      shelves: [],
      lastModified: new Date(),
    };
    this.storage.racks.push(newRack);
    return newRack;
  }

  /**
   * Finds a rack by its ID.
   * @param rackId The ID of the rack.
   * @returns The rack if found, otherwise undefined.
   */
  public getRack(rackId: string): Rack | undefined {
    return this.storage.racks.find(rack => rack.id === rackId);
  }

  /**
   * Updates an existing rack's details.
   * @param rackId The ID of the rack to update.
   * @param updates An object containing the fields to update (name, location).
   * @returns True if the rack was updated, false otherwise.
   */
  public updateRack(rackId: string, updates: Partial<Pick<Rack, 'name' >>): boolean {
    const rack = this.getRack(rackId);
    if (rack) {
      Object.assign(rack, updates);
      rack.lastModified = new Date();
      return true;
    }
    return false;
  }

  /**
   * Removes a rack from the storage.
   * @param rackId The ID of the rack to remove.
   * @returns True if the rack was removed, false otherwise.
   */
  public removeRack(rackId: string): boolean {
    const initialLength = this.storage.racks.length;
    this.storage.racks = this.storage.racks.filter(rack => rack.id !== rackId);
    return this.storage.racks.length < initialLength;
  }

  // --- Shelf Operations ---

  /**
   * Adds a new shelf to a specific rack.
   * @param rackId The ID of the rack to add the shelf to.
   * @param name The name of the shelf (e.g., "A1").
   * @param capacity The maximum capacity of the shelf.
   * @returns The newly added shelf, or undefined if the rack is not found.
   */
  public addShelf(rackId: string, name: string): Shelf | undefined {
    const rack = this.getRack(rackId);
    if (rack) {
      const newShelf: Shelf = {
        id: `shelf-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name,
        printJob: [],
        lastModified: new Date(),
      };
      rack.shelves.push(newShelf);
      rack.lastModified = new Date();
      return newShelf;
    }
    return undefined;
  }

  /**
   * Finds a shelf by its ID within a given rack.
   * @param rackId The ID of the rack.
   * @param shelfId The ID of the shelf.
   * @returns The shelf if found, otherwise undefined.
   */
  public getShelf(rackId: string, shelfId: string): Shelf | undefined {
    const rack = this.getRack(rackId);
    return rack?.shelves.find(shelf => shelf.id === shelfId);
  }

  /**
   * Updates an existing shelf's details.
   * @param rackId The ID of the rack containing the shelf.
   * @param shelfId The ID of the shelf to update.
   * @param updates An object containing the fields to update (name, capacity).
   * @returns True if the shelf was updated, false otherwise.
   */
  public updateShelf(rackId: string, shelfId: string, updates: Partial<Pick<Shelf, 'name' >>): boolean {
    const shelf = this.getShelf(rackId, shelfId);
    if (shelf) {
      Object.assign(shelf, updates);
      shelf.lastModified = new Date();
      // Also update the parent rack's modified date
      const rack = this.getRack(rackId);
      if (rack) rack.lastModified = new Date();
      return true;
    }
    return false;
  }


  /**
   * Removes a shelf from a specific rack.
   * @param rackId The ID of the rack.
   * @param shelfId The ID of the shelf to remove.
   * @returns True if the shelf was removed, false otherwise.
   */
  public removeShelf(rackId: string, shelfId: string): boolean {
    const rack = this.getRack(rackId);
    if (rack) {
      const initialLength = rack.shelves.length;
      rack.shelves = rack.shelves.filter(shelf => shelf.id !== shelfId);
      if (rack.shelves.length < initialLength) {
        rack.lastModified = new Date();
        return true;
      }
    }
    return false;
  }

  // --- Item Operations ---

  /**
   * Adds an item to a specific shelf.
   * @param rackId The ID of the rack.
   * @param shelfId The ID of the shelf.
   * @param name The name of the item.
   * @param quantity The quantity of the item.
   * @param description Optional description.
   * @param sku Optional SKU.
   * @returns The newly added item, or undefined if the shelf is not found or capacity is exceeded.
   */
  public addItem(rackId: string, shelfId: string, name: string, description?: string): PrintJob | undefined {
    const shelf = this.getShelf(rackId, shelfId);
    if (shelf) {
      // Basic capacity check (could be more sophisticated based on item size/weight)
      

      const newItem: PrintJob = {
        id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name,
        description,
        lastModified: new Date(),
      };
      shelf.printJob.push(newItem);
      shelf.lastModified = new Date();
      // Also update the parent rack's modified date
      const rack = this.getRack(rackId);
      if (rack) rack.lastModified = new Date();
      return newItem;
    }
    return undefined;
  }

  /**
   * Finds an item by its ID within a given shelf.
   * @param rackId The ID of the rack.
   * @param shelfId The ID of the shelf.
   * @param itemId The ID of the item.
   * @returns The item if found, otherwise undefined.
   */
  public getItem(rackId: string, shelfId: string, itemId: string): PrintJob | undefined {
    const shelf = this.getShelf(rackId, shelfId);
    return shelf?.printJob.find(item => item.id === itemId);
  }

  /**
   * Updates an existing item's details.
   * @param rackId The ID of the rack.
   * @param shelfId The ID of the shelf.
   * @param itemId The ID of the item to update.
   * @param updates An object containing the fields to update.
   * @returns True if the item was updated, false otherwise.
   */
  public updateItem(rackId: string, shelfId: string, itemId: string, updates: Partial<PrintJob>): boolean {
    const item = this.getItem(rackId, shelfId, itemId);
    if (item) {
      Object.assign(item, updates);
      item.lastModified = new Date();
      // Update parent shelf and rack modified dates
      const shelf = this.getShelf(rackId, shelfId);
      if (shelf) shelf.lastModified = new Date();
      const rack = this.getRack(rackId);
      if (rack) rack.lastModified = new Date();
      return true;
    }
    return false;
  }

  /**
   * Removes an item from a specific shelf.
   * @param rackId The ID of the rack.
   * @param shelfId The ID of the shelf.
   * @param itemId The ID of the item to remove.
   * @returns True if the item was removed, false otherwise.
   */
  public removeItem(rackId: string, shelfId: string, itemId: string): boolean {
    const shelf = this.getShelf(rackId, shelfId);
    if (shelf) {
      const initialLength = shelf.printJob.length;
      shelf.printJob = shelf.printJob.filter(item => item.id !== itemId);
      if (shelf.printJob.length < initialLength) {
        shelf.lastModified = new Date();
        // Update parent rack modified date
        const rack = this.getRack(rackId);
        if (rack) rack.lastModified = new Date();
        return true;
      }
    }
    return false;
  }  
}
