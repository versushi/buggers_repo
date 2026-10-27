#include <msp430.h> 
#include <stdint.h>

#define BUT2 BIT2 // Button S2 at Port 1.2

#define FLAGS UCA1IFG // Contains the transmit & receive flags
#define RXFLAG UCRXIFG // Receive flag
#define TXFLAG UCTXIFG // Transmit flag
#define TXBUFFER UCA1TXBUF // Transmit buffer
#define RXBUFFER UCA1RXBUF // Receive buffer

void Initialize_UART(void);
void uart_write_char(unsigned char ch);
unsigned char uart_read_char(void);
void uart_write_string (char * str);
void uart_write_uint16 (unsigned int n);

void Initialize_I2C(void);
int i2c_read_word(unsigned char, unsigned char, unsigned int*); 
int i2c_write_word(unsigned char, unsigned char, unsigned int);

unsigned int set_time_function(void);
void print_time(void);
void config_ACLK_to_32KHz_crystal(void);

volatile unsigned char reset_time_requested = 0;
volatile unsigned char minute_elapsed = 0;
volatile unsigned int seconds;
volatile unsigned char minute;
volatile unsigned int hour;

int main(void)
{
	WDTCTL = WDTPW | WDTHOLD; // Stop the Watchdog timer
	PM5CTL0 &= ~LOCKLPM5; 	// Enable the GPIO pins

	// Configure the buttons for interrupts
	P1DIR &= ~BUT2; // 0: input
	P1REN |= BUT2;  // 1: enable built-in resistors
	P1OUT |= BUT2;  // 1: built-in resistor is pulled up to Vcc
	P1IES |= BUT2;  // 1: interrupt on falling edge (0 for rising edge)
	P1IFG &= ~BUT2; // 0: clear the interrupt flags
	P1IE  |= BUT2; // 1: enable interrupt 

	// Configure pins to backchannel UART
	// Pins: (UCA1TXD / P3.4) (UCA1RXD / P3.5)
	// (P3SEL1=00, P3SEL0=11) (P2DIR=xx)
	P3SEL1 &= ~(BIT4|BIT5);
	P3SEL0 |= (BIT4|BIT5);

	unsigned int sensor_value;
	unsigned int confuration_value;
	unsigned long current_lux;
	unsigned int up_value;
	long down_value;
	unsigned int is_target_set;
	
	Initialize_UART();
	Initialize_I2C();
	config_ACLK_to_32KHz_crystal();

	__enable_interrupt();
	uart_write_string("*** Lux Logger ***\r\n\n\n");
	
	// Configure the Sensor the these specs 
	// RN=0111b=7 The LSB bit is worth 1.28
	// CT=0 Result produced in 100 ms
	// M=11b=3 Continuous readings
	// ME=1 Mask (hide) the Exponent from the result
	// configuration_value = 0111 0110 0000 0100
	confuration_value = 0x7604;
	i2c_write_word(0x44, 0x01, confuration_value);

	is_target_set = 0;
	uart_write_string("Enter the time (3 or 4 digits then hit Enter): ");
	set_time_function();
	seconds = 0;
	minute_elapsed = 0;
	TA0CCR0 = 32767;                   // 1 second at 32768 Hz
	TA0CCTL0 = CCIE;
	TA0CTL = TASSEL_1 | MC_1 | TACLR;

	uart_write_string("\r\nTime is set to ");
	print_time();
	uart_write_string("\r\n");

	for (;;) {
		unsigned char do_sample;
		// Button Interupt to reset time
		if (reset_time_requested) {
			// Stop the clock while the user enters the new time
			TA0CTL &= ~MC_3;

			__disable_interrupt();
			reset_time_requested = 0;
			minute_elapsed = 0;  // Discard any reading due before the reset
			__enable_interrupt();

			uart_write_string("\r\nEnter the new time (3 or 4 digits, then Enter): ");
			set_time_function();

			// Restart the clock from zero seconds
			seconds = 0;
			TA0CCTL0 &= ~CCIFG;  // Clear any pending timer interrupt
			TA0CTL = TASSEL_1 | MC_1 | TACLR;

			uart_write_string("\r\nTime is set to ");
			print_time();
			uart_write_string("\r\n");
		}
		// disable and enable interrupts every second until a minute passes
		__disable_interrupt();
		do_sample = minute_elapsed;
		minute_elapsed = 0;
		__enable_interrupt();

		// Once a minute has passed print the lux value 
		if (do_sample) {
			i2c_read_word(0x44, 0x00, &sensor_value);
			current_lux = ((unsigned long)sensor_value * 128UL) / 100UL;
			if (is_target_set == 0) {
				up_value = current_lux + 10;
				down_value = (long)current_lux - 10;
				is_target_set = 1;
			}
			print_time();
			uart_write_string("   ");
			uart_write_uint16((unsigned int)current_lux);
			uart_write_string(" lux");

			if (current_lux >= up_value) {
				uart_write_string("   <Up>");
				is_target_set = 0;
			} else if ((long)current_lux <= down_value) {
				uart_write_string("   <Down>");
				is_target_set = 0;
			}

			uart_write_string("\r\n");
			if (is_target_set == 0) {
				up_value = current_lux + 10;
				down_value = (long)current_lux - 10;
				is_target_set = 1;
			}
		}
	}
}

#pragma vector = PORT1_VECTOR
__interrupt void Port1_ISR(void)
{
    if ((P1IFG & BUT2) != 0) {
        reset_time_requested = 1;
        P1IFG &= ~BUT2;  // Clear the S2 interrupt flag
    }
}

#pragma vector = TIMER0_A0_VECTOR
__interrupt void Timer_A_ISR(void)
{
    seconds++;

    if (seconds >= 60) {
        seconds = 0;
        minute_elapsed = 1;
        minute ++;

		if(minute >= 60){
			minute = 0;
			hour++;

			if(hour>=13){
				hour = 1;
			}
		}
    }
}

void print_time (void){
	unsigned int shown_hour;
	unsigned char shown_minute;
	__disable_interrupt();
	shown_hour = hour;
	shown_minute = minute;
	__enable_interrupt();
	uart_write_uint16(shown_hour);
	uart_write_char(':');
	// Prints a leading zero for minutes 0–9
	if (shown_minute < 10) {
		uart_write_char('0'); 
	}
	uart_write_uint16(shown_minute);
}

unsigned int set_time_function(void){
	char time_input[4];
    unsigned int count;
    unsigned char ch;
	while(1){
		count = 0;

		while(1){
			ch = uart_read_char();
			// Nothing Recieved, goes back
			if (ch == 0){
				continue;
			}
			// Checks if Enter was pressed
			 if (ch == '\r' || ch == '\n') {
                break;  
            }
			if (ch >= '0' && ch <= '9') {
                uart_write_char(ch);  // Display digit as it's typed

                if (count < 4) {
                    time_input[count] = ch;
                } 
				if (count < 5) {
        			count++;  // 5 means there were too many digits
   				}
            }
        }
        // Reject entries that don't have exactly 3 or 4 digits
        if (count != 3 && count != 4) {
            uart_write_string("\r\nEnter 3 or 4 digits, then hit Enter: ");
            continue;
        }

        if (count == 3) {
            // Example: 235 means 2:35
            hour = time_input[0] - '0';

            minute = (time_input[1] - '0') * 10 + (time_input[2] - '0');
        }
        else {
            // Example: 1435 means 14:35
            hour = (time_input[0] - '0') * 10 + (time_input[1] - '0');

            minute = (time_input[2] - '0') * 10 + (time_input[3] - '0');
        }

        // Check that the entered time is valid for a 12-hour clock
        if (hour < 1 || hour > 12 || minute >= 60) {
            uart_write_string("\r\nInvalid time. Try again: ");
            continue;
        }
		return(1);
	} 
}

void Initialize_I2C(void) {
	// Configure the MCU in Master mode
	// Configure pins to I2C functionality
	// (UCB1SDA same as P4.0) (UCB1SCL same as P4.1)
	// (P4SEL1=11, P4SEL0=00) (P4DIR=xx)
	P4SEL1 |= (BIT1|BIT0);
	P4SEL0 &= ~(BIT1|BIT0);
	// Enter reset state and set all fields in this register to zero
	UCB1CTLW0 = UCSWRST;
	// Fields that should be nonzero are changed below
	// (Master Mode: UCMST) (I2C mode: UCMODE_3) (Synchronous mode: UCSYNC)
	// (UCSSEL 1:ACLK, 2,3:SMCLK)
	UCB1CTLW0 |= UCMST | UCMODE_3 | UCSYNC | UCSSEL_3;
	// Clock frequency: SMCLK/8 = 1 MHz/8 = 125 KHz
	UCB1BRW = 8;
	// Chip Data Sheet p. 53 (Should be 400 KHz max)
	// Exit the reset mode at the end of the configuration
	UCB1CTLW0 &= ~UCSWRST;
}

int i2c_read_word(unsigned char i2c_address, unsigned char i2c_reg, unsigned int * data) {
	unsigned char byte1=0, byte2=0; // Intialize to ensure successful reading
	UCB1I2CSA = i2c_address; // Set address
	UCB1IFG &= ~UCTXIFG0;
	// Transmit a byte (the internal register address)
	UCB1CTLW0 |= UCTR;
	UCB1CTLW0 |= UCTXSTT;
	while((UCB1IFG & UCTXIFG0)==0) {} // Wait for flag to raise
	UCB1TXBUF = i2c_reg; // Write in the TX buffer
	while((UCB1IFG & UCTXIFG0)==0) {} // Buffer copied to shift register; Tx in progress; set Stop bit
	// Repeated Start
	UCB1CTLW0 &= ~UCTR;
	UCB1CTLW0 |= UCTXSTT;
	// Read the first byte
	while((UCB1IFG & UCRXIFG0)==0) {} // Wait for flag to raise
	byte1 = UCB1RXBUF;
	// Assert the Stop signal bit before receiving the last byte
	UCB1CTLW0 |= UCTXSTP;
	// Read the second byte
	while((UCB1IFG & UCRXIFG0)==0) {} // Wait for flag to raise
	byte2 = UCB1RXBUF;
	while((UCB1CTLW0 & UCTXSTP)!=0) {}
	while((UCB1STATW & UCBBUSY)!=0) {}
	*data = (byte1 << 8) | (byte2 & (unsigned int)0x00FF);
	return 0;
}

int i2c_write_word(unsigned char i2c_address, unsigned char i2c_reg, unsigned int data) {
	unsigned char byte1, byte2;
	UCB1I2CSA = i2c_address; // Set I2C address
	byte1 = (data >> 8) & 0xFF; // MSByte
	byte2 = data & 0xFF; // LSByte
	UCB1IFG &= ~UCTXIFG0;
	// Write 3 bytes
	UCB1CTLW0 |= (UCTR | UCTXSTT);
	while( (UCB1IFG & UCTXIFG0) == 0) {}
	UCB1TXBUF = i2c_reg;
	while( (UCB1IFG & UCTXIFG0) == 0) {}
	UCB1TXBUF = byte1;
	while( (UCB1IFG & UCTXIFG0) == 0) {}
	UCB1TXBUF = byte2;
	while( (UCB1IFG & UCTXIFG0) == 0) {}
	UCB1CTLW0 |= UCTXSTP;
	while( (UCB1CTLW0 & UCTXSTP) != 0 ) {}
	while((UCB1STATW & UCBBUSY)!=0) {}
	return 0;
}
// Configure UART to the popular configuration
// 9600 baud, 8-bit data, LSB first, no parity bits, 1 stop bit
// no flow control, oversampling reception
// Clock: SMCLK @ 1 MHz (1,000,000 Hz)
void Initialize_UART(void){
	// Configure pins to UART functionality
	P3SEL1 &= ~(BIT4|BIT5);
	P3SEL0 |= (BIT4|BIT5);
	// Main configuration register
	UCA1CTLW0 = UCSWRST; // Engage reset; change all the fields to zero
	// Most fields in this register, when set to zero, correspond to the
	// popular configuration
	UCA1CTLW0 |= UCSSEL_2; // Set clock to SMCLK
	// Configure the clock dividers and modulators (and enable oversampling)
	UCA1BRW = 6; // divider
	// Modulators: UCBRF = 8 = 1000 --> UCBRF3 (bit #3)
	// UCBRS = 0x20 = 0010 0000 = UCBRS5 (bit #5)
	UCA1MCTLW = UCBRF3 | UCBRS5 | UCOS16;
	// Exit the reset state
	UCA1CTLW0 &= ~UCSWRST;
}

void uart_write_uint16 (unsigned int n){
	unsigned int m = 0;
	char digits[5];
	// This checks if the number is 0
	if (n == 0) {
		uart_write_char('0');
		return;
	}
	
	while (n > 0) {
		// Cuts far right digit and puts into array
        digits[m] = '0' + (n % 10);
		// Goes to the next spot in array
        m++;
		// Makes n smaller ie from 4567 --> 456
        n /= 10;
    }
	// This loop prints the array backwards since it was uploaded into the array backwards
    while (m > 0) {
        m--;
        uart_write_char(digits[m]);
    }
}

void uart_write_string (char * str_array){
	unsigned int i;
	for(i = 0;str_array[i] != '\0';i++){
		uart_write_char(str_array[i]);
	}
}

unsigned char uart_read_char(void){
	unsigned char temp;
	// Return null character (ASCII=0) if no byte was received
	if( (FLAGS & RXFLAG) == 0)
	return 0;
	// Otherwise, copy the received byte (this clears the flag) and return it
	temp = RXBUFFER;
	return temp;
}

void uart_write_char(unsigned char ch){
	// Wait for any ongoing transmission to complete
	while ( (FLAGS & TXFLAG) == 0 ) {}
	// Copy the byte to the transmit buffer
	TXBUFFER = ch; // Tx flag goes to 0 and Tx begins!
	return;
}

// Configures ACLK to 32 KHz crystal
void config_ACLK_to_32KHz_crystal() {
// By default, ACLK runs on LFMODCLK at 5MHz/128 = 39 KHz
// Reroute pins to LFXIN/LFXOUT functionality
	PJSEL1 &= ~BIT4;
	PJSEL0 |= BIT4;
	// Wait until the oscillator fault flags remain cleared
	CSCTL0 = CSKEY; // Unlock CS registers
	do {
		CSCTL5 &= ~LFXTOFFG; // Local fault flag
		SFRIFG1 &= ~OFIFG; // Global fault flag
	}
	while((CSCTL5 & LFXTOFFG) != 0);
		CSCTL0_H = 0; // Lock CS registers
	return;
}
