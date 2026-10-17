#include <msp430.h> 
#include <stdint.h>

#define redLED BIT0 // Red LED at P1.0
#define greenLED BIT7 // Green LED at P9.7

#define FLAGS UCA1IFG // Contains the transmit & receive flags
#define RXFLAG UCRXIFG // Receive flag
#define TXFLAG UCTXIFG // Transmit flag
#define TXBUFFER UCA1TXBUF // Transmit buffer
#define RXBUFFER UCA1RXBUF // Receive buffer

void Initialize_UART(void);
void uart_write_char(unsigned char ch);
unsigned char uart_read_char(void);
void uart_write_uint16 (unsigned int n);
void uart_write_string (char * str);

int main(void)
{
	WDTCTL = WDTPW | WDTHOLD;	// stop watchdog timer
	PM5CTL0 &= ~LOCKLPM5; 	// Enable the GPIO pins
	
	P1DIR |= redLED; 		// Direct pin as output
	P9DIR |= greenLED; 		// Direct pin as output
	P1OUT &= ~redLED; 		// Turn LED Off
	P9OUT &= ~greenLED; 	// Turn LED Off

	// Configure pins to backchannel UART
	// Pins: (UCA1TXD / P3.4) (UCA1RXD / P3.5)
	// (P3SEL1=00, P3SEL0=11) (P2DIR=xx)
	P3SEL1 &= ~(BIT4|BIT5);
	P3SEL0 |= (BIT4|BIT5);

	Initialize_UART();
	

	uart_write_string("Hello Friends\r\n");
	uart_write_uint16 (0);
	uart_write_string("\r\n");
	for(;;){}
}

// This function works by cutting off the right most digit of  n and putting it into an array
// so the array as n with the digits being read backwards. 
// We add it to 0 becasue 0s ASCII value is 48, adding the digit will bump it up to the proper
// ASCII variable for said digit
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
// The function returns the byte; if none received, returns null character
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