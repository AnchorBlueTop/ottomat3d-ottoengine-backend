import React, { useState } from 'react';

const onToggle = (event: React.MouseEvent | React.ChangeEvent | React.KeyboardEvent | Event, isExpanded: boolean) => {
  setIsOpen(isExpanded);
}; 