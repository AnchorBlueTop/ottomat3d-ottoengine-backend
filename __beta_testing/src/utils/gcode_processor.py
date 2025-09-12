"""
G-code Processor for OTTOMAT3D
Handles downloading, modifying, and uploading G-code files for specific printer types
"""

import requests
import tempfile
import os
from pathlib import Path
from urllib.parse import quote
from utils.logger import setup_logger
import time
import hashlib
import uuid
import re

class GCodeProcessor:
    """Handles G-code file processing for various printer types"""
    
    def __init__(self, printer_ip, printer_brand):
        self.printer_ip = printer_ip
        self.printer_brand = printer_brand.upper()
        self.logger = setup_logger()
        self.temp_dir = None
    
    def __enter__(self):
        """Context manager entry - create temp directory"""
        self.temp_dir = tempfile.mkdtemp(prefix="ottomat3d_gcode_")
        self.logger.debug(f"Created temporary directory: {self.temp_dir}")
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        """Context manager exit - cleanup temp directory"""
        if self.temp_dir and os.path.exists(self.temp_dir):
            import shutil
            try:
                shutil.rmtree(self.temp_dir)
                self.logger.debug(f"Cleaned up temporary directory: {self.temp_dir}")
            except Exception as e:
                self.logger.warning(f"Failed to cleanup temp directory: {e}")
    
    def download_gcode_file(self, filename, show_progress=True):
        """
        Download a G-code file from the printer
        
        Args:
            filename: Name of the G-code file
            show_progress: Whether to show download progress
        
        Returns:
            str: Path to downloaded file, or None if failed
        """
        # Different download URLs for different printer brands
        if self.printer_brand == "ANYCUBIC":
            # Anycubic uses Moonraker API
            encoded_filename = quote(filename)
            download_url = f"http://{self.printer_ip}/server/files/gcodes/{encoded_filename}"
        elif self.printer_brand == "ELEGOO":
            # Elegoo uses /local/ endpoint
            download_url = f"http://{self.printer_ip}/local/{filename}"
        else:
            self.logger.error(f"Unsupported printer brand for G-code processing: {self.printer_brand}")
            return None
        
        self.logger.info(f"Downloading G-code file: {filename}")
        self.logger.debug(f"Download URL: {download_url}")
        
        local_path = os.path.join(self.temp_dir, filename)
        
        try:
            # Start download
            response = requests.get(download_url, stream=True, timeout=30)
            response.raise_for_status()
            
            # Get file size if available
            total_size = int(response.headers.get('content-length', 0))
            
            downloaded_size = 0
            chunk_size = 8192  # 8KB chunks
            last_progress_update = 0
            
            with open(local_path, 'wb') as f:
                for chunk in response.iter_content(chunk_size=chunk_size):
                    if chunk:
                        f.write(chunk)
                        downloaded_size += len(chunk)
                        
                        if show_progress and total_size > 0:
                            progress = (downloaded_size / total_size) * 100
                            # Update progress every 1MB or when complete
                            if (downloaded_size - last_progress_update) >= (1024*1024) or progress >= 100:
                                size_mb = downloaded_size / (1024*1024)
                                total_mb = total_size / (1024*1024)
                                print(f"    📥 {filename}: {size_mb:.1f}MB / {total_mb:.1f}MB ({progress:.1f}%)")
                                last_progress_update = downloaded_size
            
            final_size_mb = downloaded_size / (1024*1024)
            self.logger.info(f"✅ Downloaded {filename} ({final_size_mb:.1f}MB)")
            return local_path
            
        except requests.exceptions.RequestException as e:
            self.logger.error(f"❌ Failed to download {filename}: {e}")
            return None
        except Exception as e:
            self.logger.error(f"❌ Error downloading {filename}: {e}")
            return None
    
    def _check_z_positioning_exists(self, lines, z_position, start_line=0, end_line=None):
        """
        Check if Z positioning command already exists in the given line range
        IMPROVED: Now detects ANY Z positioning command regardless of F speed
        
        Args:
            lines: List of file lines
            z_position: Z position to check for (e.g., "200", "205")
            start_line: Start line index to search from
            end_line: End line index to search to (None = end of file)
        
        Returns:
            bool: True if Z positioning command exists, False otherwise
        """
        if end_line is None:
            end_line = len(lines)
        
        # Create case-insensitive pattern for ANY Z positioning command
        # Matches patterns like: G1 Z200, G1 Z200 F600, G1Z200F1500, g1 z200 f300, etc.
        # This is more flexible and will catch existing commands with any F speed
        pattern = rf'g1\s*z\s*{z_position}(?:\s*f\d+)?'
        
        for i in range(start_line, min(end_line, len(lines))):
            # Clean line: remove spaces, semicolons, and convert to lowercase
            line_clean = lines[i].replace(' ', '').replace(';', '').lower()
            if re.search(pattern, line_clean):
                self.logger.info(f"ℹ️  Z{z_position} positioning command already exists at line {i+1}: {lines[i].strip()}")
                return True
        
        return False
    
    def _check_machine_end_gcode_has_z_command(self, machine_line, z_position):
        """
        Check if machine_end_gcode line already contains Z positioning command
        IMPROVED: Now uses the same robust pattern matching as EXECUTABLE_BLOCK_END
        
        Args:
            machine_line: The machine_end_gcode line to check
            z_position: Z position to check for (e.g., "200", "205")
        
        Returns:
            bool: True if Z positioning command exists, False otherwise
        """
        # Create case-insensitive pattern for ANY Z positioning command in machine_end_gcode
        # This handles escaped newlines like \\n and various formatting
        pattern = rf'g1\s*z\s*{z_position}(?:\s*f\d+)?'
        
        # Clean the line: handle escaped newlines, remove spaces, convert to lowercase
        line_clean = machine_line.replace('\\n', ' ').replace(' ', '').lower()
        if re.search(pattern, line_clean):
            self.logger.info(f"ℹ️  Z{z_position} positioning command already exists in machine_end_gcode")
            return True
        
        return False
    
    def modify_gcode_file(self, file_path):
        """
        Modify G-code file based on printer brand
        
        Args:
            file_path: Path to the G-code file to modify
        
        Returns:
            bool: True if modification successful, False otherwise
        """
        if self.printer_brand == "ANYCUBIC":
            return self._modify_anycubic_gcode(file_path)
        elif self.printer_brand == "ELEGOO":
            return self._modify_elegoo_gcode(file_path)
        else:
            self.logger.error(f"Unsupported printer brand for G-code modification: {self.printer_brand}")
            return False
    
    def _modify_anycubic_gcode(self, file_path):
        """
        Modify Anycubic G-code file to add Z200 positioning commands
        
        Args:
            file_path: Path to the G-code file to modify
        
        Returns:
            bool: True if modification successful, False otherwise
        """
        try:
            self.logger.info(f"Modifying Anycubic G-code file: {os.path.basename(file_path)}")
            
            # Read the file
            with open(file_path, 'r', encoding='utf-8') as f:
                lines = f.readlines()
            
            total_lines = len(lines)
            self.logger.debug(f"File has {total_lines} lines")
            
            modified = False
            
            # 1. Find and modify the EXECUTABLE_BLOCK_END section
            executable_block_line = None
            for i in range(total_lines - 1, -1, -1):  # Search from bottom
                if "; EXECUTABLE_BLOCK_END" in lines[i]:
                    executable_block_line = i
                    break
            
            if executable_block_line is not None:
                # Check if Z200 positioning already exists in the EXECUTABLE_BLOCK_END section
                section_start = max(0, executable_block_line - 20)
                if self._check_z_positioning_exists(lines, "200", section_start, executable_block_line):
                    self.logger.info("ℹ️  Z200 command already exists in EXECUTABLE_BLOCK_END section")
                else:
                    # Find the Y270 throw_position_y line and insert Z200 AFTER it
                    y270_line = None
                    for j in range(max(0, executable_block_line - 15), executable_block_line):
                        if "G1 Y270" in lines[j] and "throw_position_y" in lines[j]:
                            y270_line = j
                            break
                    
                    if y270_line is not None:
                        # Insert Z200 command right after Y270 line
                        lines.insert(y270_line + 1, "G1 Z200 F600;\n")
                        self.logger.info("✅ Added Z200 command after Y270 throw_position_y")
                        modified = True
                    else:
                        self.logger.warning("⚠️  Could not find 'G1 Y270; throw_position_y' line before EXECUTABLE_BLOCK_END")
            else:
                self.logger.error("❌ Could not find '; EXECUTABLE_BLOCK_END' in G-code file")
                return False
            
            # 2. Find and modify the machine_end_gcode section
            machine_end_line = None
            for i, line in enumerate(lines):
                if "; machine_end_gcode" in line and "=" in line:
                    machine_end_line = i
                    break
            
            if machine_end_line is not None:
                # Use the improved checking function for machine_end_gcode
                if self._check_machine_end_gcode_has_z_command(lines[machine_end_line], "200"):
                    self.logger.info("ℹ️  Z200 command already exists in machine_end_gcode")
                else:
                    # Modify the machine_end_gcode line
                    original_line = lines[machine_end_line]
                    
                    # Add Z200 command AFTER Y270 positioning (correct order)
                    if "G1 Y270; throw_position_y" in original_line:
                        new_line = original_line.replace(
                            "G1 Y270; throw_position_y",
                            "G1 Y270; throw_position_y\\nG1 Z200 F600;"
                        )
                        lines[machine_end_line] = new_line
                        self.logger.info("✅ Added Z200 command after Y270 in machine_end_gcode")
                        modified = True
                    else:
                        self.logger.warning("⚠️  Could not find 'G1 Y270; throw_position_y' in machine_end_gcode")
            else:
                self.logger.warning("⚠️  Could not find 'machine_end_gcode' section")
            
            # Write the modified file back
            if modified:
                with open(file_path, 'w', encoding='utf-8') as f:
                    f.writelines(lines)
                self.logger.info(f"✅ Anycubic G-code file modified successfully: {os.path.basename(file_path)}")
            else:
                self.logger.info(f"ℹ️  No modifications needed for: {os.path.basename(file_path)}")
            
            return True
            
        except Exception as e:
            self.logger.error(f"❌ Error modifying Anycubic G-code file: {e}")
            return False
    
    def _modify_elegoo_gcode(self, file_path):
        """
        Modify Elegoo G-code file to add Z205 positioning commands
        IMPROVED: Better duplicate detection prevents adding redundant commands
        
        Args:
            file_path: Path to the G-code file to modify
        
        Returns:
            bool: True if modification successful, False otherwise
        """
        try:
            self.logger.info(f"Modifying Elegoo G-code file: {os.path.basename(file_path)}")
            
            # Read the file
            with open(file_path, 'r', encoding='utf-8') as f:
                lines = f.readlines()
            
            total_lines = len(lines)
            self.logger.debug(f"File has {total_lines} lines")
            
            modified = False
            
            # 1. Find and modify the EXECUTABLE_BLOCK_END section
            executable_block_line = None
            for i in range(total_lines - 1, -1, -1):  # Search from bottom
                if "; EXECUTABLE_BLOCK_END" in lines[i]:
                    executable_block_line = i
                    break
            
            if executable_block_line is not None:
                # Check if Z205 positioning already exists in the EXECUTABLE_BLOCK_END section
                section_start = max(0, executable_block_line - 20)
                if self._check_z_positioning_exists(lines, "205", section_start, executable_block_line):
                    self.logger.info("ℹ️  Z205 command already exists in EXECUTABLE_BLOCK_END section")
                else:
                    # Insert Z205 command 8 lines above EXECUTABLE_BLOCK_END (after M400, before G92 E0)
                    insert_line = max(0, executable_block_line - 8)
                    lines.insert(insert_line, "G1 Z205 F600\n")
                    self.logger.info("✅ Added Z205 command 8 lines before EXECUTABLE_BLOCK_END")
                    modified = True
            else:
                self.logger.error("❌ Could not find '; EXECUTABLE_BLOCK_END' in G-code file")
                return False
            
            # 2. Find and modify the machine_end_gcode section
            machine_end_line = None
            for i, line in enumerate(lines):
                if "; machine_end_gcode" in line and "=" in line:
                    machine_end_line = i
                    break
            
            if machine_end_line is not None:
                # Use the improved checking function for machine_end_gcode
                if self._check_machine_end_gcode_has_z_command(lines[machine_end_line], "205"):
                    self.logger.info("ℹ️  Z205 command already exists in machine_end_gcode")
                else:
                    # For machine_end_gcode, we need to add it in the right position
                    # Look for M400 pattern and add Z205 after it
                    original_line = lines[machine_end_line]
                    
                    # Add Z205 command after M400 pattern in the machine end gcode
                    if "M400\\n" in original_line:
                        new_line = original_line.replace(
                            "M400\\n",
                            "M400\\nG1 Z205 F600\\n"
                        )
                        lines[machine_end_line] = new_line
                        self.logger.info("✅ Added Z205 command after M400 in machine_end_gcode")
                        modified = True
                    else:
                        self.logger.warning("⚠️  Could not find 'M400' pattern in machine_end_gcode")
            else:
                self.logger.warning("⚠️  Could not find 'machine_end_gcode' section")
            
            # Write the modified file back
            if modified:
                with open(file_path, 'w', encoding='utf-8') as f:
                    f.writelines(lines)
                self.logger.info(f"✅ Elegoo G-code file modified successfully: {os.path.basename(file_path)}")
            else:
                self.logger.info(f"ℹ️  No modifications needed for: {os.path.basename(file_path)}")
            
            return True
            
        except Exception as e:
            self.logger.error(f"❌ Error modifying Elegoo G-code file: {e}")
            return False
    
    def upload_gcode_file(self, file_path, filename):
        """
        Upload G-code file based on printer brand
        
        Args:
            file_path: Local path to the file to upload
            filename: Target filename on printer
        
        Returns:
            bool: True if upload successful, False otherwise
        """
        if self.printer_brand == "ANYCUBIC":
            return self._upload_gcode_file_anycubic(file_path, filename)
        elif self.printer_brand == "ELEGOO":
            return self._upload_gcode_file_elegoo(file_path, filename)
        else:
            self.logger.error(f"Unsupported printer brand for G-code upload: {self.printer_brand}")
            return False
    
    def _upload_gcode_file_anycubic(self, file_path, filename):
        """
        Upload G-code file to Anycubic printer via Moonraker API
        
        Args:
            file_path: Local path to the file to upload
            filename: Target filename on printer
        
        Returns:
            bool: True if upload successful, False otherwise
        """
        upload_url = f"http://{self.printer_ip}/server/files/upload"
        
        self.logger.info(f"Uploading modified G-code to Anycubic: {filename}")
        
        try:
            # Get file size for progress
            file_size = os.path.getsize(file_path)
            file_size_mb = file_size / (1024*1024)
            
            # Prepare multipart form data
            with open(file_path, 'rb') as f:
                files = {
                    'file': (filename, f, 'application/octet-stream')
                }
                
                # Moonraker upload parameters
                data = {
                    'root': 'gcodes',  # Upload to gcodes directory
                    'overwrite': 'true'  # Overwrite existing file
                }
                
                print(f"    📤 Uploading {filename} ({file_size_mb:.1f}MB)...")
                response = requests.post(upload_url, files=files, data=data, timeout=120)
                response.raise_for_status()
                
                # Check response
                if response.status_code in [200, 201]:
                    self.logger.info(f"✅ Upload successful: {filename}")
                    return True
                else:
                    self.logger.error(f"❌ Upload failed: HTTP {response.status_code}")
                    self.logger.error(f"Response: {response.text}")
                    return False
                    
        except requests.exceptions.RequestException as e:
            self.logger.error(f"❌ Upload failed for {filename}: {e}")
            return False
        except Exception as e:
            self.logger.error(f"❌ Error uploading {filename}: {e}")
            return False
    
    def _upload_gcode_file_elegoo(self, file_path, filename):
        """
        Upload G-code file to Elegoo printer via improved multipart form data
        Handles large files with chunked upload and better error handling
        
        Args:
            file_path: Local path to the file to upload
            filename: Target filename on printer
        
        Returns:
            bool: True if upload successful, False otherwise
        """
        upload_url = f"http://{self.printer_ip}/uploadFile/upload"
        
        self.logger.info(f"Uploading modified G-code to Elegoo: {filename}")
        
        try:
            # Read the file
            with open(file_path, 'rb') as f:
                file_content = f.read()
            
            file_size = len(file_content)
            file_size_mb = file_size / (1024*1024)
            
            # For large files (>2MB), try chunked approach first
            if file_size > 2 * 1024 * 1024:  # 2MB threshold
                self.logger.info(f"Large file detected ({file_size_mb:.1f}MB), using chunked upload...")
                if self._upload_elegoo_chunked(file_content, filename, upload_url):
                    return True
                else:
                    self.logger.warning("Chunked upload failed, falling back to single request...")
            
            # Single request upload (original method but with improvements)
            return self._upload_elegoo_single_request(file_content, filename, upload_url)
                
        except Exception as e:
            self.logger.error(f"❌ Error uploading {filename}: {e}")
            return False
    
    def _upload_elegoo_chunked(self, file_content, filename, upload_url):
        """
        Upload large files to Elegoo using chunked approach
        """
        file_size = len(file_content)
        chunk_size = 1024 * 1024  # 1MB chunks
        md5_hash = hashlib.md5(file_content).hexdigest()
        upload_uuid = str(uuid.uuid4()).replace('-', '')
        
        print(f"    📤 Uploading {filename} in chunks ({file_size/1024/1024:.1f}MB)...")
        
        # Upload in chunks
        offset = 0
        chunk_num = 0
        total_chunks = (file_size + chunk_size - 1) // chunk_size
        
        while offset < file_size:
            chunk_end = min(offset + chunk_size, file_size)
            chunk_data = file_content[offset:chunk_end]
            chunk_num += 1
            
            # Create boundary for this chunk
            boundary = f"----webkitformboundary{upload_uuid}{chunk_num:04d}"
            
            # Build multipart body for this chunk
            body_parts = []
            
            # Add form fields
            fields = {
                'TotalSize': str(file_size),
                'Uuid': upload_uuid,
                'Offset': str(offset),
                'Check': '1' if offset == 0 else '0',  # Only check on first chunk
                'S-File-MD5': md5_hash if offset == 0 else ''  # Only send MD5 on first chunk
            }
            
            for field_name, field_value in fields.items():
                if field_value:  # Only add non-empty fields
                    body_parts.append(f'--{boundary}')
                    body_parts.append(f'Content-Disposition: form-data; name="{field_name}"')
                    body_parts.append('')
                    body_parts.append(field_value)
            
            # Add file chunk
            body_parts.append(f'--{boundary}')
            body_parts.append(f'Content-Disposition: form-data; name="File"; filename="{filename}"')
            body_parts.append('Content-Type: application/octet-stream')
            body_parts.append('')
            
            # Join text parts
            body_text = '\r\n'.join(body_parts) + '\r\n'
            
            # Create final body with chunk content
            body = body_text.encode('utf-8') + chunk_data + f'\r\n--{boundary}--\r\n'.encode('utf-8')
            
            # Upload headers
            headers = {
                'Content-Type': f'multipart/form-data; boundary={boundary}',
                'Content-Length': str(len(body))
            }
            
            # Show progress
            progress = (chunk_num / total_chunks) * 100
            print(f"    📤 Chunk {chunk_num}/{total_chunks} ({progress:.1f}%)...")
            
            try:
                response = requests.post(upload_url, data=body, headers=headers, timeout=60)
                
                if response.status_code != 200:
                    self.logger.error(f"Chunk {chunk_num} failed: HTTP {response.status_code}")
                    return False
                    
            except requests.exceptions.RequestException as e:
                self.logger.error(f"Chunk {chunk_num} failed: {e}")
                return False
            
            offset = chunk_end
        
        print(f"    ✅ All {total_chunks} chunks uploaded successfully!")
        self.logger.info(f"✅ Chunked upload successful: {filename}")
        return True
    
    def _upload_elegoo_single_request(self, file_content, filename, upload_url):
        """
        Upload file using single request (improved version of original method)
        """
        file_size = len(file_content)
        file_size_mb = file_size / (1024*1024)
        
        # Calculate MD5 hash
        md5_hash = hashlib.md5(file_content).hexdigest()
        
        # Generate UUID for upload
        upload_uuid = str(uuid.uuid4()).replace('-', '')
        
        # Use a simpler boundary format that matches browser behavior more closely
        boundary = f"----formdata-polyfill-{upload_uuid}"
        
        # Build multipart body with exact browser-like formatting
        body_parts = []
        
        # Add form fields with exact spacing
        fields = {
            'TotalSize': str(file_size),
            'Uuid': upload_uuid,
            'Offset': '0',
            'Check': '1',
            'S-File-MD5': md5_hash
        }
        
        for field_name, field_value in fields.items():
            body_parts.append(f'--{boundary}')
            body_parts.append(f'Content-Disposition: form-data; name="{field_name}"')
            body_parts.append('')
            body_parts.append(field_value)
        
        # Add file with exact browser-like formatting
        body_parts.append(f'--{boundary}')
        body_parts.append(f'Content-Disposition: form-data; name="File"; filename="{filename}"')
        body_parts.append('Content-Type: application/octet-stream')
        body_parts.append('')
        
        # Join text parts
        body_text = '\r\n'.join(body_parts) + '\r\n'
        
        # Create final body with file content
        body = body_text.encode('utf-8') + file_content + f'\r\n--{boundary}--\r\n'.encode('utf-8')
        
        # Upload headers with additional browser-like headers
        headers = {
            'Content-Type': f'multipart/form-data; boundary={boundary}',
            'Content-Length': str(len(body)),
            'Connection': 'keep-alive',
            'Accept': '*/*'
        }
        
        print(f"    📤 Uploading {filename} ({file_size_mb:.1f}MB)...")
        
        try:
            # Use longer timeout for large files and add retry logic
            timeout = max(180, file_size_mb * 30)  # At least 30 seconds per MB
            
            response = requests.post(upload_url, data=body, headers=headers, timeout=timeout)
            
            if response.status_code == 200:
                self.logger.info(f"✅ Upload successful: {filename}")
                return True
            else:
                self.logger.error(f"❌ Upload failed: HTTP {response.status_code}")
                self.logger.error(f"Response: {response.text}")
                return False
                
        except requests.exceptions.ConnectionError as e:
            if "Connection reset by peer" in str(e):
                self.logger.error("❌ Connection reset by peer - file may be too large for single request")
                self.logger.error("Try using smaller files or contact support for chunked upload improvements")
            else:
                self.logger.error(f"❌ Connection error: {e}")
            return False
        except requests.exceptions.Timeout:
            self.logger.error("❌ Upload timeout - file may be too large or connection too slow")
            return False
        except Exception as e:
            self.logger.error(f"❌ Upload error: {e}")
            return False
    
    def process_job_files(self, job_filenames):
        """
        Process all G-code files for automation sequence
        
        Args:
            job_filenames: List of G-code filenames to process
        
        Returns:
            bool: True if all files processed successfully, False otherwise
        """
        brand_display = self.printer_brand.title()
        z_position = "Z200" if self.printer_brand == "ANYCUBIC" else "Z205"
        
        self.logger.info(f"🔄 Starting G-code file processing for {brand_display} printer...")
        print(f"\n🔄 {brand_display.upper()} G-CODE PREPROCESSING:")
        print("─" * 45)
        print(f"Downloading, modifying, and uploading G-code files to add {z_position} positioning...")
        print("This ensures proper bed positioning during automation.")
        print()
        
        total_files = len(job_filenames)
        processed_files = 0
        
        for i, filename in enumerate(job_filenames, 1):
            print(f"📋 Processing file {i}/{total_files}: {filename}")
            print("─" * 50)
            
            # Step 1: Download
            print(f"  📥 Step 1/3: Downloading {filename}...")
            local_path = self.download_gcode_file(filename, show_progress=True)
            if not local_path:
                print(f"  ❌ Download failed for {filename}")
                self.logger.error(f"G-code processing stopped due to download failure: {filename}")
                return False
            
            # Step 2: Modify
            print(f"  ✏️  Step 2/3: Modifying G-code...")
            if not self.modify_gcode_file(local_path):
                print(f"  ❌ Modification failed for {filename}")
                self.logger.error(f"G-code processing stopped due to modification failure: {filename}")
                return False
            
            # Check if file was actually modified (to show appropriate message)
            with open(local_path, 'r', encoding='utf-8') as f:
                modified_content = f.read()
            
            if f"{z_position} F600" in modified_content.upper():
                print(f"    ✅ {z_position} positioning commands verified in file")
            else:
                print(f"    ⚠️  Could not verify {z_position} commands in modified file")
            
            # Step 3: Upload
            print(f"  📤 Step 3/3: Uploading modified file...")
            if not self.upload_gcode_file(local_path, filename):
                print(f"  ❌ Upload failed for {filename}")
                self.logger.error(f"G-code processing stopped due to upload failure: {filename}")
                return False
            
            processed_files += 1
            print(f"  ✅ Successfully processed {filename}")
            print()
        
        print(f"🎉 G-code preprocessing completed successfully!")
        print(f"   Processed {processed_files}/{total_files} files")
        print(f"   All files now have {z_position} positioning commands")
        print()
        
        self.logger.info(f"✅ Successfully processed all {processed_files} G-code files")
        return True

def process_printer_gcode_files(printer_ip, printer_brand, job_filenames):
    """
    Convenience function to process G-code files for supported printers
    
    Args:
        printer_ip: IP address of the printer
        printer_brand: Brand of the printer ("Anycubic" or "Elegoo")
        job_filenames: List of G-code filenames to process
    
    Returns:
        bool: True if all files processed successfully, False otherwise
    """
    try:
        with GCodeProcessor(printer_ip, printer_brand) as processor:
            return processor.process_job_files(job_filenames)
    except Exception as e:
        logger = setup_logger()
        logger.error(f"❌ G-code processing failed: {e}")
        print(f"❌ G-code processing failed: {e}")
        return False

# Backward compatibility functions
def process_anycubic_gcode_files(printer_ip, job_filenames):
    """Backward compatibility function for Anycubic"""
    return process_printer_gcode_files(printer_ip, "Anycubic", job_filenames)

def process_elegoo_gcode_files(printer_ip, job_filenames):
    """Convenience function for Elegoo"""
    return process_printer_gcode_files(printer_ip, "Elegoo", job_filenames)
