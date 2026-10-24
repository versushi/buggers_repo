#include <msp430.h> 
#include <stdint.h>

void Initialize_UART(void);
void uart_write_char(unsigned char ch);
unsigned char uart_read_char(void);
void uart_write_string (char * str);

int main(void)
{
	WDTCTL = WDTPW | WDTHOLD; // Stop the Watchdog timer
	PM5CTL0 &= ~LOCKLPM5; 	// Enable the GPIO pins

	// Configure pins to backchannel UART
	// Pins: (UCA1TXD / P3.4) (UCA1RXD / P3.5)
	// (P3SEL1=00, P3SEL0=11) (P2DIR=xx)
	P3SEL1 &= ~(BIT4|BIT5);
	P3SEL0 |= (BIT4|BIT5);
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
